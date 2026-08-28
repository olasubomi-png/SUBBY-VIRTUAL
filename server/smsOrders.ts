import { randomUUID } from "node:crypto";
import type { SMSProvider } from "./domain";
import {
  assertSmsOrderTransition,
  isTerminalSmsOrderStatus,
  normalizeSmsOrderStatus,
  toPublicSmsOrder,
  type SmsOrderRecord,
  type SmsOrderStatus,
} from "./smsOrderLifecycle";
import {
  addDemoCredits,
  cancelSms as cancelDemoSms,
  createDemoActivation,
  debitDemoCredits,
  expireActivation as expireDemoActivation,
  getActivation as getDemoActivation,
  getDemoWallet,
  listActivations as listDemoActivations,
  simulateSms as simulateDemoSms,
  type DemoActivation,
} from "./demoState";
import { shouldUsePersistentStore } from "./persistenceMode";
import {
  cancelPersistentActivation,
  completePersistentActivation,
  createSmsOrderAtomic,
  findSmsOrderByIdempotencyKey,
  getPersistentActivation,
  listPersistentActivations,
  transitionPersistentSmsOrder,
  type CreateSmsOrderAtomicInput,
} from "./persistence";

const DEFAULT_TTL_MS = 30 * 60_000;

export type CreateSmsOrderInput = {
  userId: number;
  country: string;
  serviceId: string;
  idempotencyKey: string;
  provider: SMSProvider;
  providerType?: string;
};

function demoToOrder(item: DemoActivation): SmsOrderRecord {
  const status = normalizeSmsOrderStatus(item.status);
  return {
    id: item.id,
    userId: item.userId,
    serviceId: item.serviceId,
    countryCode: item.country,
    priceMinor: item.priceMinor,
    currency: "NGN",
    status,
    providerType: "MOCK",
    providerReference: item.providerReference ?? null,
    phoneNumber: item.phoneNumber,
    verificationCode: item.verificationCode ?? item.message?.body.match(/\d{4,8}/)?.[0] ?? null,
    idempotencyKey: item.idempotencyKey ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    expiresAt: item.expiresAt,
    cancelledAt: item.cancelledAt ?? null,
    completedAt:
      status === "completed" ? (item.message?.receivedAt ?? item.updatedAt ?? item.createdAt) : null,
  };
}

async function createDemoOrder(input: CreateSmsOrderInput): Promise<{
  order: SmsOrderRecord;
  walletBalanceMinor: number;
  reused: boolean;
}> {
  const countries = await input.provider.getCountries();
  if (!countries.some(c => c.code === input.country)) {
    throw new Error("Unknown SMS country");
  }
  const services = await input.provider.getServices();
  if (!services.some(s => s.id === input.serviceId)) {
    throw new Error("Unknown SMS service");
  }
  const pricing = await input.provider.getPricing();
  const quote = pricing.find(p => p.serviceId === input.serviceId);
  if (!quote) throw new Error("Unknown SMS service");
  if (quote.currency !== "NGN" && quote.currency !== "USD") {
    throw new Error("Invalid currency");
  }

  const existing = listDemoActivations(input.userId).find(
    a => a.idempotencyKey === input.idempotencyKey
  );
  if (existing) {
    return {
      order: demoToOrder(existing),
      walletBalanceMinor: getDemoWallet(input.userId).balanceMinor,
      reused: true,
    };
  }

  const wallet = getDemoWallet(input.userId);
  if (wallet.balanceMinor < quote.amount) {
    throw new Error("Insufficient balance");
  }

  const debitRef = `sms-order-${input.userId}-${input.idempotencyKey}`;
  debitDemoCredits(
    input.userId,
    quote.amount,
    `${quote.serviceId} SMS activation`,
    debitRef
  );

  let order = createDemoActivation({
    userId: input.userId,
    country: input.country,
    serviceId: input.serviceId,
    priceMinor: quote.amount,
    currency: quote.currency,
    idempotencyKey: input.idempotencyKey,
    status: "pending",
  });

  try {
    order = transitionDemoOrder(order.id, input.userId, "allocating");
    const providerResult = await input.provider.buyActivation({
      userId: input.userId,
      country: input.country,
      serviceId: input.serviceId,
    });
    order = transitionDemoOrder(order.id, input.userId, "active", {
      phoneNumber: providerResult.phoneNumber,
      providerReference: providerResult.id,
    });
  } catch {
    transitionDemoOrder(order.id, input.userId, "failed");
    throw new Error("Unable to allocate SMS number");
  }

  return {
    order: demoToOrder(getDemoActivation(input.userId, order.id)),
    walletBalanceMinor: getDemoWallet(input.userId).balanceMinor,
    reused: false,
  };
}

function transitionDemoOrder(
  id: string,
  userId: number,
  to: SmsOrderStatus,
  patch?: Partial<DemoActivation>
): DemoActivation {
  const item = getDemoActivation(userId, id);
  const from = normalizeSmsOrderStatus(item.status);
  assertSmsOrderTransition(from, to);
  item.status = to as DemoActivation["status"];
  item.updatedAt = new Date().toISOString();
  if (patch?.phoneNumber) item.phoneNumber = patch.phoneNumber;
  if (patch?.providerReference) item.providerReference = patch.providerReference;
  if (patch?.verificationCode) item.verificationCode = patch.verificationCode;
  if (to === "cancelled") item.cancelledAt = item.updatedAt;
  if (to === "completed") {
    item.message = {
      sender: "SUBBY-DEMO",
      body: `Your simulated verification code is ${item.verificationCode ?? "482913"}.`,
      receivedAt: item.updatedAt,
    };
  }
  return item;
}

async function createPersistentOrder(input: CreateSmsOrderInput): Promise<{
  order: SmsOrderRecord;
  walletBalanceMinor: number;
  reused: boolean;
}> {
  const countries = await input.provider.getCountries();
  if (!countries.some(c => c.code === input.country)) {
    throw new Error("Unknown SMS country");
  }
  const services = await input.provider.getServices();
  if (!services.some(s => s.id === input.serviceId)) {
    throw new Error("Unknown SMS service");
  }
  const pricing = await input.provider.getPricing();
  const quote = pricing.find(p => p.serviceId === input.serviceId);
  if (!quote) throw new Error("Unknown SMS service");
  if (quote.currency !== "NGN" && quote.currency !== "USD") {
    throw new Error("Invalid currency");
  }

  const existing = await findSmsOrderByIdempotencyKey(
    input.userId,
    input.idempotencyKey
  );
  if (existing) {
    const detail = await getPersistentActivation(input.userId, existing.id);
    return {
      order: publicDetailToRecord(detail, existing),
      walletBalanceMinor: (
        await import("./persistence").then(m => m.getPersistentWallet(input.userId))
      ).balanceMinor,
      reused: true,
    };
  }

  const externalId = `sms-order-${input.userId}-${input.idempotencyKey}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_TTL_MS);

  const atomicInput: CreateSmsOrderAtomicInput = {
    userId: input.userId,
    externalId,
    idempotencyKey: input.idempotencyKey,
    providerType: input.providerType ?? "MOCK",
    countryCode: input.country,
    serviceId: input.serviceId,
    quotedPriceMinor: quote.amount,
    currency: quote.currency,
    status: "pending",
    expiresAt,
    debitReason: `${quote.serviceId} SMS activation`,
    debitReference: `sms-order-${input.userId}-${input.idempotencyKey}`,
  };

  let created;
  try {
    created = await createSmsOrderAtomic(atomicInput);
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient balance") {
      throw error;
    }
    // Concurrent duplicate idempotency insert
    const raced = await findSmsOrderByIdempotencyKey(
      input.userId,
      input.idempotencyKey
    );
    if (raced) {
      const detail = await getPersistentActivation(input.userId, raced.id);
      return {
        order: publicDetailToRecord(detail, raced),
        walletBalanceMinor: (
          await import("./persistence").then(m =>
            m.getPersistentWallet(input.userId)
          )
        ).balanceMinor,
        reused: true,
      };
    }
    throw error instanceof Error ? error : new Error("Unable to create SMS order");
  }

  if (created.reused) {
    const detail = await getPersistentActivation(input.userId, created.order.id);
    return {
      order: publicDetailToRecord(detail, created.order),
      walletBalanceMinor: created.balanceMinor,
      reused: true,
    };
  }

  try {
    await transitionPersistentSmsOrder({
      userId: input.userId,
      externalId: created.order.id,
      to: "allocating",
    });
    const providerResult = await input.provider.buyActivation({
      userId: input.userId,
      country: input.country,
      serviceId: input.serviceId,
    });
    await transitionPersistentSmsOrder({
      userId: input.userId,
      externalId: created.order.id,
      to: "active",
      phoneNumber: providerResult.phoneNumber,
      providerReference: providerResult.id,
    });
  } catch {
    try {
      await transitionPersistentSmsOrder({
        userId: input.userId,
        externalId: created.order.id,
        to: "failed",
      });
    } catch {
      // ignore secondary failure
    }
    throw new Error("Unable to allocate SMS number");
  }

  const detail = await getPersistentActivation(input.userId, created.order.id);
  const row = await findSmsOrderByIdempotencyKey(
    input.userId,
    input.idempotencyKey
  );
  return {
    order: publicDetailToRecord(detail, row ?? created.order),
    walletBalanceMinor: created.balanceMinor,
    reused: false,
  };
}

function publicDetailToRecord(
  detail: Awaited<ReturnType<typeof getPersistentActivation>>,
  row?: { id: string; status?: string } | null
): SmsOrderRecord {
  const status = normalizeSmsOrderStatus(
    (detail as { status: string }).status ?? row?.status ?? "active"
  );
  return {
    id: detail.id,
    userId: detail.userId,
    serviceId: detail.serviceId,
    countryCode: detail.country,
    priceMinor: detail.priceMinor,
    currency: "NGN",
    status,
    providerType: "MOCK",
    providerReference: (detail as { providerReference?: string }).providerReference,
    phoneNumber: detail.phoneNumber,
    verificationCode: detail.message?.body.match(/\d{4,8}/)?.[0] ?? null,
    idempotencyKey: null,
    createdAt: detail.createdAt,
    updatedAt: detail.createdAt,
    expiresAt: detail.expiresAt,
    cancelledAt: null,
    completedAt: status === "completed" ? detail.message?.receivedAt : null,
  };
}

export async function createSmsOrder(input: CreateSmsOrderInput) {
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    throw new Error("Idempotency key is required");
  }
  const result = shouldUsePersistentStore()
    ? await createPersistentOrder(input)
    : await createDemoOrder(input);
  return {
    ...toPublicSmsOrder(result.order),
    walletBalanceMinor: result.walletBalanceMinor,
    reused: result.reused,
    audit: result.order.providerType === "MOCK"
      ? "Mock request created; no external provider contacted."
      : "SMS order created.",
  };
}

export async function getSmsOrder(userId: number, id: string) {
  if (shouldUsePersistentStore()) {
    const detail = await getPersistentActivation(userId, id);
    return {
      ...detail,
      status: normalizeSmsOrderStatus(detail.status),
      countryCode: detail.country,
    };
  }
  return toPublicSmsOrder(demoToOrder(getDemoActivation(userId, id)));
}

export async function listSmsOrders(userId: number) {
  if (shouldUsePersistentStore()) {
    const rows = await listPersistentActivations(userId);
    return rows.map(row => ({
      ...row,
      status: normalizeSmsOrderStatus(row.status),
      countryCode: row.country,
    }));
  }
  return listDemoActivations(userId).map(item => toPublicSmsOrder(demoToOrder(item)));
}

export async function cancelSmsOrder(userId: number, id: string) {
  if (shouldUsePersistentStore()) {
    const current = await getPersistentActivation(userId, id);
    const from = normalizeSmsOrderStatus(current.status);
    if (isTerminalSmsOrderStatus(from)) {
      throw new Error("SMS order is terminal and cannot be cancelled");
    }
    assertSmsOrderTransition(from, "cancelled");
    await cancelPersistentActivation(userId, id);
    return getSmsOrder(userId, id);
  }
  const item = getDemoActivation(userId, id);
  const from = normalizeSmsOrderStatus(item.status);
  assertSmsOrderTransition(from, "cancelled");
  cancelDemoSms(userId, id);
  item.status = "cancelled" as DemoActivation["status"];
  item.cancelledAt = new Date().toISOString();
  item.updatedAt = item.cancelledAt;
  return toPublicSmsOrder(demoToOrder(item));
}

export async function markSmsCodeReceived(
  userId: number,
  id: string,
  code: string
) {
  if (shouldUsePersistentStore()) {
    await transitionPersistentSmsOrder({
      userId,
      externalId: id,
      to: "code_received",
      verificationCode: code,
    });
    await completePersistentActivation({
      userId,
      externalId: id,
      sender: "SUBBY-DEMO",
      body: `Your simulated verification code is ${code}.`,
      receivedAt: new Date(),
    });
    return getSmsOrder(userId, id);
  }
  const item = getDemoActivation(userId, id);
  assertSmsOrderTransition(normalizeSmsOrderStatus(item.status), "code_received");
  item.verificationCode = code;
  item.status = "code_received" as DemoActivation["status"];
  item.updatedAt = new Date().toISOString();
  assertSmsOrderTransition("code_received", "completed");
  simulateDemoSms(userId, id);
  item.status = "completed" as DemoActivation["status"];
  return toPublicSmsOrder(demoToOrder(item));
}

export async function expireSmsOrder(userId: number, id: string) {
  if (shouldUsePersistentStore()) {
    const current = await getPersistentActivation(userId, id);
    const from = normalizeSmsOrderStatus(current.status);
    assertSmsOrderTransition(from, "expired");
    await transitionPersistentSmsOrder({
      userId,
      externalId: id,
      to: "expired",
    });
    return getSmsOrder(userId, id);
  }
  const item = getDemoActivation(userId, id);
  assertSmsOrderTransition(normalizeSmsOrderStatus(item.status), "expired");
  expireDemoActivation(userId, id);
  item.status = "expired" as DemoActivation["status"];
  return toPublicSmsOrder(demoToOrder(item));
}

/** Test helper — seed demo credits without going through HTTP. */
export function seedDemoCreditsForTests(
  userId: number,
  amountMinor: number,
  reference = `seed-${randomUUID()}`
) {
  return addDemoCredits(userId, amountMinor, reference);
}
