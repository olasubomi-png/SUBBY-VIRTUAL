/**
 * Production SMS activation/order lifecycle.
 * Provider-agnostic state machine — works with MockSMSProvider and future providers.
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

/** Explicit allowed transitions. Terminal states accept none. */
export const SMS_ORDER_TRANSITIONS: Record<
  SmsOrderStatus,
  readonly SmsOrderStatus[]
> = {
  pending: ["allocating", "cancelled", "expired", "failed"],
  allocating: ["active", "cancelled", "expired", "failed"],
  active: ["code_received", "cancelled", "expired", "failed"],
  code_received: ["completed", "cancelled", "failed"],
  completed: [],
  cancelled: [],
  expired: [],
  failed: [],
};

export function isSmsOrderStatus(value: string): value is SmsOrderStatus {
  return (SMS_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminalSmsOrderStatus(status: SmsOrderStatus): boolean {
  return (TERMINAL_SMS_ORDER_STATUSES as readonly string[]).includes(status);
}

export function canTransitionSmsOrder(
  from: SmsOrderStatus,
  to: SmsOrderStatus
): boolean {
  return SMS_ORDER_TRANSITIONS[from].includes(to);
}

export function assertSmsOrderTransition(
  from: SmsOrderStatus,
  to: SmsOrderStatus
): void {
  if (!canTransitionSmsOrder(from, to)) {
    throw new Error(`Invalid SMS order transition: ${from} → ${to}`);
  }
  if (isTerminalSmsOrderStatus(from)) {
    throw new Error(`SMS order is terminal (${from}) and cannot be modified`);
  }
}

/**
 * Normalize legacy status strings used before the production lifecycle.
 * Keeps older rows and in-flight demo data interoperable.
 */
export function normalizeSmsOrderStatus(status: string): SmsOrderStatus {
  const map: Record<string, SmsOrderStatus> = {
    pending: "pending",
    allocating: "allocating",
    active: "active",
    code_received: "code_received",
    completed: "completed",
    cancelled: "cancelled",
    expired: "expired",
    failed: "failed",
    // Legacy
    WAITING: "active",
    ACTIVE: "active",
    MESSAGE_RECEIVED: "code_received",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
    FAILED: "failed",
  };
  const normalized = map[status] ?? map[status.toLowerCase()];
  if (!normalized) {
    throw new Error("Unknown SMS order status");
  }
  return normalized;
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
    providerMode: order.providerType === "MOCK" ? ("mock" as const) : ("live" as const),
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
