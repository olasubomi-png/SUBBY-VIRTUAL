/**
 * Production SMS activation/order lifecycle.
 * Provider-agnostic state machine — works with MockSMSProvider and future providers.
 *
 * Canonical states only inside domain logic. Legacy uppercase statuses may exist in
 * older rows; normalize them at the boundary via normalizeSmsOrderStatus() before
 * any transition checks or writes.
 */

export const SMS_ORDER_STATUSES = [
  "pending",
  "allocating",
  "active",
  "code_received",
  "completed",
  "cancelled",
  "expired",
  "failed",
] as const;

export type SmsOrderStatus = (typeof SMS_ORDER_STATUSES)[number];

export const TERMINAL_SMS_ORDER_STATUSES: readonly SmsOrderStatus[] = [
  "completed",
  "cancelled",
  "expired",
  "failed",
] as const;

/**
 * Explicit allowed transitions.
 * Terminal states accept none.
 *
 * Required happy path:
 *   pending → allocating → active → code_received → completed
 * Branching:
 *   allocating → failed
 *   active → cancelled | expired | failed
 *   code_received → cancelled | expired
 * Also allowed operational exits from early states:
 *   pending → cancelled | expired | failed
 *   allocating → cancelled | expired
 */
export const SMS_ORDER_TRANSITIONS: Record<
  SmsOrderStatus,
  readonly SmsOrderStatus[]
> = {
  pending: ["allocating", "cancelled", "expired", "failed"],
  allocating: ["active", "cancelled", "expired", "failed"],
  active: ["code_received", "cancelled", "expired", "failed"],
  code_received: ["completed", "cancelled", "expired"],
  completed: [],
  cancelled: [],
  expired: [],
  failed: [],
};

const LEGACY_STATUS_MAP: Record<string, SmsOrderStatus> = {
  WAITING: "active",
  ACTIVE: "active",
  MESSAGE_RECEIVED: "code_received",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  FAILED: "failed",
};

export function isSmsOrderStatus(value: string): value is SmsOrderStatus {
  return (SMS_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminalSmsOrderStatus(status: SmsOrderStatus): boolean {
  return (TERMINAL_SMS_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Normalize legacy or mixed-case status strings into canonical lowercase states.
 * Domain/service code must call this before transition logic.
 */
export function normalizeSmsOrderStatus(status: string): SmsOrderStatus {
  if (isSmsOrderStatus(status)) return status;
  const legacy = LEGACY_STATUS_MAP[status];
  if (legacy) return legacy;
  const lower = status.trim().toLowerCase();
  if (isSmsOrderStatus(lower)) return lower;
  throw new Error("Unknown SMS order status");
}

export function canTransitionSmsOrder(
  from: SmsOrderStatus,
  to: SmsOrderStatus
): boolean {
  return SMS_ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Assert a transition between already-canonical statuses.
 * Rejects invalid and terminal-source transitions.
 */
export function assertSmsOrderTransition(
  from: SmsOrderStatus,
  to: SmsOrderStatus
): void {
  if (isTerminalSmsOrderStatus(from)) {
    throw new Error(`SMS order is terminal (${from}) and cannot be modified`);
  }
  if (!canTransitionSmsOrder(from, to)) {
    throw new Error(`Invalid SMS order transition: ${from} → ${to}`);
  }
}

/**
 * Boundary helper: normalize raw stored status, then assert transition to a
 * canonical target. Use this at persistence/demo boundaries that may still
 * hold legacy uppercase values.
 */
export function assertSmsOrderTransitionFromRaw(
  fromRaw: string,
  to: SmsOrderStatus
): SmsOrderStatus {
  const from = normalizeSmsOrderStatus(fromRaw);
  assertSmsOrderTransition(from, to);
  return from;
}

/** States that may still receive a simulated verification code. */
export function isCodeEligibleSmsOrderStatus(status: SmsOrderStatus): boolean {
  return status === "active" || status === "code_received";
}

/** States that may be cancelled. */
export function isCancellableSmsOrderStatus(status: SmsOrderStatus): boolean {
  return canTransitionSmsOrder(status, "cancelled");
}

/** States that may expire. */
export function isExpirableSmsOrderStatus(status: SmsOrderStatus): boolean {
  return canTransitionSmsOrder(status, "expired");
}

/** States treated as "in flight" for simulation job queueing. */
export function isSimulatableSmsOrderStatus(status: SmsOrderStatus): boolean {
  return status === "active";
}

export type SmsOrderRecord = {
  id: string;
  userId: number;
  serviceId: string;
  countryCode: string;
  priceMinor: number;
  currency: "NGN" | "USD";
  status: SmsOrderStatus;
  providerType: string;
  providerReference?: string | null;
  phoneNumber?: string | null;
  verificationCode?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  cancelledAt?: string | null;
  completedAt?: string | null;
};

/** Safe client-facing order shape — no internal provider error details. */
export function toPublicSmsOrder(order: SmsOrderRecord) {
  return {
    id: order.id,
    serviceId: order.serviceId,
    country: order.countryCode,
    countryCode: order.countryCode,
    priceMinor: order.priceMinor,
    currency: order.currency,
    status: order.status,
    phoneNumber: order.phoneNumber ?? "",
    verificationCode: order.verificationCode ?? undefined,
    providerMode:
      order.providerType === "MOCK" ? ("mock" as const) : ("live" as const),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    expiresAt: order.expiresAt,
    cancelledAt: order.cancelledAt ?? undefined,
    completedAt: order.completedAt ?? undefined,
    message: order.verificationCode
      ? {
          sender: "SUBBY-DEMO",
          body: `Your simulated verification code is ${order.verificationCode}.`,
          receivedAt: order.updatedAt,
        }
      : undefined,
  };
}
