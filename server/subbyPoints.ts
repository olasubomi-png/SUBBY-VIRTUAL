/**
 * SUBBY Points — user-facing billing unit.
 *
 * Authoritative business rules (server-side only):
 *   1 SUBBY Point = 1 virtual number / SMS activation
 *   1 SUBBY Point = ₦500 NGN = 50_000 kobo
 *
 * Ledger representation:
 *   1 Point = 1 ledger unit (integer). Wallet balances are stored as points.
 *
 * Never use floating-point arithmetic for balances, debits, or Paystack amounts.
 */

export const POINTS_UNIT_NAME = "SUBBY Points";

/** 1 Point = ₦500 */
export const NGN_MAJOR_PER_POINT = 500 as const;

/** 1 Point = 50_000 kobo (NGN minor units for Paystack). */
export const KOBO_PER_POINT = 50_000 as const;

/** 1 SMS / virtual-number activation costs exactly 1 Point. */
export const SMS_ACTIVATION_POINTS = 1 as const;

/** Pricing version snapshot for top-ups and orders. */
export const POINTS_PRICING_VERSION = "points-v1-500ngn" as const;

export const POINTS_PER_LEDGER_MINOR = 1 as const;

/** Convert ledger units → points (identity). */
export function minorToPoints(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error("Invalid amount");
  }
  return amountMinor * POINTS_PER_LEDGER_MINOR;
}

/** Convert points → ledger units (identity). */
export function pointsToMinor(points: number): number {
  if (!Number.isSafeInteger(points) || points < 0) {
    throw new Error("Points must be a non-negative integer");
  }
  return points / POINTS_PER_LEDGER_MINOR;
}

export function assertPositivePoints(points: number): void {
  if (!Number.isSafeInteger(points) || points <= 0) {
    throw new Error("Points amount must be a positive integer");
  }
}

/**
 * Authoritative NGN kobo for a points quantity.
 * points × 50_000 — integer only.
 */
export function pointsToKobo(points: number): number {
  assertPositivePoints(points);
  const product = BigInt(points) * BigInt(KOBO_PER_POINT);
  if (product > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Payment amount overflow");
  }
  return Number(product);
}

/** Inverse check: expected points for a kobo amount under current pricing. */
export function koboToPointsExact(kobo: number): number {
  if (!Number.isSafeInteger(kobo) || kobo <= 0) {
    throw new Error("Invalid kobo amount");
  }
  if (kobo % KOBO_PER_POINT !== 0) {
    throw new Error("Kobo amount is not an exact multiple of the point price");
  }
  return kobo / KOBO_PER_POINT;
}

export type LedgerEntryType =
  | "CREDIT"
  | "DEBIT"
  | "REFUND"
  | "ADMIN_ADJUSTMENT";

export const CREDIT_LIKE_TYPES: readonly LedgerEntryType[] = [
  "CREDIT",
  "REFUND",
] as const;

export function isCreditEffect(
  type: LedgerEntryType,
  direction?: "credit" | "debit" | null
): boolean {
  if (type === "ADMIN_ADJUSTMENT") {
    if (direction !== "credit" && direction !== "debit") {
      throw new Error("ADMIN_ADJUSTMENT requires direction");
    }
    return direction === "credit";
  }
  return type === "CREDIT" || type === "REFUND";
}

/** Format points for display (no currency symbol). */
export function formatPoints(points: number): string {
  if (!Number.isSafeInteger(points)) return "0";
  return points.toLocaleString("en-US");
}

/** Format NGN major from kobo for display strings only. */
export function formatNgnFromKobo(kobo: number): string {
  if (!Number.isSafeInteger(kobo)) return "₦0";
  const major = Math.trunc(kobo / 100);
  return `₦${major.toLocaleString("en-US")}`;
}
