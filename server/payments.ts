/**
 * Top-up orchestration: package → intent → provider init → verify → atomic credit.
 */
import { randomUUID } from "node:crypto";
import { getPointPackage, listPointPackages } from "./pointPackages";
import {
  getConfiguredPaymentProvider,
  type PaymentProvider,
  MockPaymentProvider,
} from "./paymentProviders";
import { shouldUsePersistentStore } from "./persistenceMode";
import {
  createPointTopUpIntent,
  getPointTopUpByExternalId,
  getPointTopUpByPaymentReference,
  completeVerifiedPointTopUp,
  listUserTopUpIntents,
  writeAuditLog,
} from "./persistence";
import { minorToPoints } from "./subbyPoints";

export function listSafePointPackages() {
  return listPointPackages().map(p => ({
    id: p.id,
    label: p.label,
    points: p.points,
    amountMinor: p.amountMinor,
    ngnMajor: p.ngnMajor,
    currency: p.currency,
    pricingVersion: p.pricingVersion,
  }));
}

function buildPaymentReference(userId: number, idempotencyKey: string): string {
  // Paystack-friendly unique reference (no secrets)
  const compact = idempotencyKey.replace(/-/g, "").slice(0, 16);
  return `sbp_${userId}_${compact}`;
}

export async function initializePointTopUp(input: {
  userId: number;
  email: string;
  packageId: string;
  idempotencyKey: string;
  provider?: PaymentProvider;
}) {
  const pkg = getPointPackage(input.packageId);
  const provider = input.provider ?? getConfiguredPaymentProvider();
  const paymentReference = buildPaymentReference(
    input.userId,
    input.idempotencyKey
  );

  if (!shouldUsePersistentStore()) {
    // Demo/in-memory path — still uses provider initialize
    const init = await provider.initialize({
      email: input.email,
      amountMinor: pkg.amountMinor,
      reference: paymentReference,
      currency: "NGN",
      metadata: {
        packageId: pkg.id,
        points: pkg.points,
        userId: input.userId,
      },
    });
    return {
      topUpId: `topup-demo-${input.userId}-${input.idempotencyKey}`,
      packageId: pkg.id,
      points: pkg.points,
      amountMinor: pkg.amountMinor,
      currency: pkg.currency,
      status: "pending" as const,
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
      provider: init.provider,
    };
  }

  const intent = await createPointTopUpIntent({
    userId: input.userId,
    points: pkg.points,
    amountMinor: pkg.amountMinor,
    currency: pkg.currency,
    idempotencyKey: input.idempotencyKey,
    packageId: pkg.id,
    paymentReference,
    provider: provider.mode,
  });

  // Reuse existing provider session if already initialized
  if (intent.status === "completed") {
    return {
      topUpId: intent.externalId,
      packageId: pkg.id,
      points: intent.points,
      amountMinor: intent.amountMinor,
      currency: intent.currency as "NGN",
      status: "completed" as const,
      authorizationUrl: null as string | null,
      reference: intent.paymentReference ?? paymentReference,
      provider: provider.mode,
    };
  }

  const init = await provider.initialize({
    email: input.email,
    amountMinor: intent.amountMinor,
    reference: intent.paymentReference ?? paymentReference,
    currency: "NGN",
    metadata: {
      packageId: pkg.id,
      points: intent.points,
      userId: input.userId,
      topUpId: intent.externalId,
    },
  });

  return {
    topUpId: intent.externalId,
    packageId: pkg.id,
    points: intent.points,
    amountMinor: intent.amountMinor,
    currency: intent.currency as "NGN",
    status: intent.status as "pending" | "processing" | "completed",
    authorizationUrl: init.authorizationUrl,
    reference: init.reference,
    provider: init.provider,
  };
}

/**
 * Defense-in-depth: verify with provider API, match amount/currency, credit once.
 */
export async function settleTopUpFromProvider(input: {
  paymentReference: string;
  provider?: PaymentProvider;
  source: "webhook" | "status_poll" | "mock";
}) {
  const provider = input.provider ?? getConfiguredPaymentProvider();
  const verified = await provider.verify(input.paymentReference);

  if (verified.status !== "success") {
    return {
      settled: false as const,
      status: verified.status,
      reason: "provider_not_success",
    };
  }

  if (!shouldUsePersistentStore()) {
    return {
      settled: false as const,
      status: verified.status,
      reason: "demo_mode_no_persistent_credit",
    };
  }

  const intent =
    (await getPointTopUpByPaymentReference(input.paymentReference)) ??
    null;
  if (!intent) {
    return {
      settled: false as const,
      status: "failed" as const,
      reason: "unknown_reference",
    };
  }

  if (intent.status === "completed") {
    return {
      settled: true as const,
      status: "completed" as const,
      topUpId: intent.externalId,
      points: intent.points,
      alreadyCompleted: true,
    };
  }

  if (verified.amountMinor !== intent.amountMinor) {
    await writeAuditLog({
      actorUserId: intent.userId,
      action: "payments.amount_mismatch",
      targetType: "topup",
      targetId: intent.externalId,
      metadata: {
        expected: intent.amountMinor,
        received: verified.amountMinor,
        source: input.source,
      },
    }).catch(() => undefined);
    return {
      settled: false as const,
      status: "failed" as const,
      reason: "amount_mismatch",
    };
  }

  if (verified.currency.toUpperCase() !== "NGN") {
    return {
      settled: false as const,
      status: "failed" as const,
      reason: "currency_mismatch",
    };
  }

  const completed = await completeVerifiedPointTopUp({
    userId: intent.userId,
    externalId: intent.externalId,
    paymentReference: input.paymentReference,
  });

  await writeAuditLog({
    actorUserId: intent.userId,
    action: "payments.topup_completed",
    targetType: "topup",
    targetId: intent.externalId,
    metadata: {
      points: intent.points,
      amountMinor: intent.amountMinor,
      source: input.source,
    },
  }).catch(() => undefined);

  return {
    settled: true as const,
    status: "completed" as const,
    topUpId: completed.externalId,
    points: completed.points,
    alreadyCompleted: false,
  };
}

export async function getTopUpStatusForUser(input: {
  userId: number;
  topUpId: string;
  provider?: PaymentProvider;
}) {
  if (!shouldUsePersistentStore()) {
    return {
      topUpId: input.topUpId,
      status: "pending" as const,
      points: 0,
      amountMinor: 0,
      currency: "NGN" as const,
      createdAt: new Date().toISOString(),
      completedAt: null as string | null,
    };
  }

  const intent = await getPointTopUpByExternalId(input.userId, input.topUpId);
  if (!intent) throw new Error("Top-up not found");

  // If still pending and has payment reference, try settle (idempotent)
  if (
    (intent.status === "pending" || intent.status === "processing") &&
    intent.paymentReference
  ) {
    try {
      await settleTopUpFromProvider({
        paymentReference: intent.paymentReference,
        provider: input.provider,
        source: "status_poll",
      });
    } catch {
      // leave pending
    }
  }

  const refreshed = await getPointTopUpByExternalId(input.userId, input.topUpId);
  if (!refreshed) throw new Error("Top-up not found");

  return {
    topUpId: refreshed.externalId,
    status: refreshed.status,
    points: refreshed.points,
    amountMinor: refreshed.amountMinor,
    currency: refreshed.currency as "NGN",
    createdAt: refreshed.createdAt.toISOString(),
    completedAt: refreshed.completedAt?.toISOString() ?? null,
  };
}

export async function handlePaystackWebhook(input: {
  rawBody: Buffer;
  signature: string;
  provider?: PaymentProvider;
}) {
  const provider = input.provider ?? getConfiguredPaymentProvider();
  if (!provider.verifyWebhookSignature(input.rawBody, input.signature)) {
    return { ok: false as const, error: "invalid_signature" };
  }

  let payload: {
    event?: string;
    data?: { reference?: string; status?: string };
  };
  try {
    payload = JSON.parse(input.rawBody.toString("utf8"));
  } catch {
    return { ok: false as const, error: "malformed_payload" };
  }

  const event = payload.event ?? "";
  // Only charge success events drive settlement; others are ignored safely
  if (event !== "charge.success") {
    return { ok: true as const, ignored: true, event };
  }

  const reference = payload.data?.reference;
  if (!reference || typeof reference !== "string") {
    return { ok: false as const, error: "missing_reference" };
  }

  const result = await settleTopUpFromProvider({
    paymentReference: reference,
    provider,
    source: "webhook",
  });

  return { ok: true as const, result };
}

/** Test-only: complete mock payment then settle. */
export async function completeMockTopUpForTests(input: {
  paymentReference: string;
  amountMinor: number;
  provider: MockPaymentProvider;
}) {
  input.provider.completeForTests(input.paymentReference, input.amountMinor);
  return settleTopUpFromProvider({
    paymentReference: input.paymentReference,
    provider: input.provider,
    source: "mock",
  });
}
