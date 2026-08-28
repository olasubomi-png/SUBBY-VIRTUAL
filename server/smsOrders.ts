import { randomUUID } from "node:crypto";
import type { SMSProvider } from "./domain";
import { ExternalSmsProvider } from "./externalSmsProvider";
import {
  safeSmsProviderClientMessage,
  SmsProviderError,
} from "./smsProviderErrors";
import { providerStatusToCanonicalTarget } from "./smsProviderMapping";
import { resolvePriceQuote } from "./smsCatalog";
import { parseMarkupBps } from "./smsPricing";
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

async function refundSmsAllocation(
  userId: number,
  amountMinor: number,
  idempotencyKey: string
) {
  const reference = `sms-refund-${userId}-${idempotencyKey}`;
  if (shouldUsePersistentStore()) {
    const { creditPersistentWallet } = await import("./persistence");
    await creditPersistentWallet(userId, amountMinor, reference);
  } else {
    addDemoCredits(userId, amountMinor, reference);
  }
}


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
    providerType: (item as { providerType?: string }).providerType ?? "MOCK",
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
  const priceQuote = await resolvePriceQuote(
    input.provider,
    input.country,
    input.serviceId
  );
  if (priceQuote.currency !== "NGN" && priceQuote.currency !== "USD") {
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
  if (wallet.balanceMinor < priceQuote.retailPriceMinor) {
    throw new Error("Insufficient balance");
  }

  const debitRef = `sms-order-${input.userId}-${input.idempotencyKey}`;
  debitDemoCredits(
    input.userId,
    priceQuote.retailPriceMinor,
    `${priceQuote.serviceId} SMS activation`,
    debitRef
  );

  let order = createDemoActivation({
    userId: input.userId,
    country: input.country,
    serviceId: input.serviceId,
    priceMinor: priceQuote.retailPriceMinor,
    currency: priceQuote.currency,
    idempotencyKey: input.idempotencyKey,
    status: "pending",
  });
  (order as { providerCostMinor?: number }).providerCostMinor =
    priceQuote.providerCostMinor;
  (order as { pricingVersion?: string }).pricingVersion =
    priceQuote.pricingVersion;

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
  } catch (error) {
    try {
      transitionDemoOrder(order.id, input.userId, "failed");
    } catch {
      // ignore transition race
    }
    try {
      await refundSmsAllocation(
        input.userId,
        priceQuote.retailPriceMinor,
        input.idempotencyKey
      );
    } catch {
      // refund best-effort; debit reference remains for audit
    }
    throw new Error(safeSmsProviderClientMessage(error));
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
  const priceQuote = await resolvePriceQuote(
    input.provider,
    input.country,
    input.serviceId
  );
  if (priceQuote.currency !== "NGN" && priceQuote.currency !== "USD") {
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
    quotedPriceMinor: priceQuote.retailPriceMinor,
    providerCostMinor: priceQuote.providerCostMinor,
    pricingVersion: priceQuote.pricingVersion,
    markupBps: parseMarkupBps(process.env.SMS_MARKUP_BPS),
    currency: priceQuote.currency,
    status: "pending",
    expiresAt,
    debitReason: `${priceQuote.serviceId} SMS activation`,
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
  } catch (error) {
    try {
      await transitionPersistentSmsOrder({
        userId: input.userId,
        externalId: created.order.id,
        to: "failed",
      });
    } catch {
      // ignore secondary failure
    }
    try {
      await refundSmsAllocation(
        input.userId,
        priceQuote.retailPriceMinor,
        input.idempotencyKey
      );
    } catch {
      // refund best-effort
    }
    throw new Error(safeSmsProviderClientMessage(error));
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
    providerType:
      (detail as { providerType?: string }).providerType ??
      (row as { providerType?: string } | null | undefined)?.providerType ??
      "MOCK",
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

export async function cancelSmsOrder(
  userId: number,
  id: string,
  provider?: SMSProvider
) {
  if (shouldUsePersistentStore()) {
    const current = await getPersistentActivation(userId, id);
    const from = normalizeSmsOrderStatus(current.status);
    if (isTerminalSmsOrderStatus(from)) {
      throw new Error("SMS order is terminal and cannot be cancelled");
    }
    assertSmsOrderTransition(from, "cancelled");
    const providerRef =
      (current as { providerReference?: string }).providerReference ??
      undefined;
    if (provider && providerRef) {
      try {
        await provider.cancelActivation(providerRef);
      } catch {
        // Still cancel locally; provider release is best-effort
      }
    }
    await cancelPersistentActivation(userId, id);
    return getSmsOrder(userId, id);
  }
  const item = getDemoActivation(userId, id);
  const from = normalizeSmsOrderStatus(item.status);
  assertSmsOrderTransition(from, "cancelled");
  if (provider && item.providerReference) {
    try {
      await provider.cancelActivation(item.providerReference);
    } catch {
      // best-effort
    }
  }
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


/**
 * Poll the active SMS provider once for a verification code.
 * Bounded, idempotent, ownership-checked. Does not run unbounded loops.
 */
export async function pollSmsOrderCode(
  userId: number,
  id: string,
  provider: SMSProvider
) {
  const order = await getSmsOrder(userId, id);
  const status = normalizeSmsOrderStatus(order.status);
  if (isTerminalSmsOrderStatus(status)) {
    return order;
  }
  if (status !== "active" && status !== "code_received") {
    throw new Error("SMS order is not awaiting a verification code");
  }

  const providerRef =
    (order as { providerReference?: string }).providerReference ??
    (shouldUsePersistentStore()
      ? undefined
      : getDemoActivation(userId, id).providerReference);

  // Mock path: no provider reference required; simulation remains via jobs
  if (!providerRef) {
    if (provider instanceof ExternalSmsProvider) {
      throw new Error("SMS order has no provider reference");
    }
    return order;
  }

  const remote = await provider.getStatus(providerRef);
  const target = providerStatusToCanonicalTarget(remote.status);
  if (!target) {
    return order;
  }
  if (target === "code_received" && remote.code) {
    return markSmsCodeReceived(userId, id, remote.code);
  }
  if (target === "cancelled") {
    return cancelSmsOrder(userId, id, provider);
  }
  return order;
}

export async function expireSmsOrderWithProvider(
  userId: number,
  id: string,
  provider?: SMSProvider
) {
  const order = await getSmsOrder(userId, id);
  const providerRef =
    (order as { providerReference?: string }).providerReference ??
    (!shouldUsePersistentStore()
      ? getDemoActivation(userId, id).providerReference
      : undefined);
  if (provider && providerRef) {
    try {
      await provider.cancelActivation(providerRef);
    } catch {
      // best-effort release
    }
  }
  return expireSmsOrder(userId, id);
}
