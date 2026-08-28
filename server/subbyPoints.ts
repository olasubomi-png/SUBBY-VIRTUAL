/**
 * SUBBY Points — user-facing billing unit.
 *
 * Representation:
 *   1 SUBBY Point = 1 existing wallet ledger minor unit (integer).
 *
 * Historical NGN-minor balances and SMS prices map 1:1 into Points without
 * rescaling. Wallet currency code in storage may remain "NGN" for schema
 * compatibility; the API presents balances as points.
 *
 * Never use floating-point arithmetic for balances or debits.
 */

export const POINTS_UNIT_NAME = "SUBBY Points";
export const POINTS_PER_LEDGER_MINOR = 1 as const;

/** Convert ledger minor units → points (identity). */
export function minorToPoints(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error("Invalid amount");
  }
  return amountMinor * POINTS_PER_LEDGER_MINOR;
}

/** Convert points → ledger minor units (identity). */
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
