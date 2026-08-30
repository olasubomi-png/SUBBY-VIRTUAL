/**
 * SUBBY Points — user-facing billing unit.
 *
 * Point denomination (wallet top-ups / package pricing):
 *   1 SUBBY Point = ₦500 NGN = 50_000 kobo
 *
 * SMS activation pricing is **dynamic** from the live provider catalog:
 *   provider cost → FX to NGN kobo → markup (SMS_MARKUP_BPS) → retail kobo
 *   points charged = ceil(retailKobo / 50_000)
 *
 * Ledger representation: 1 Point = 1 ledger unit (integer).
 * Never use floating-point arithmetic for balances or debits.
 */

export const POINTS_UNIT_NAME = "SUBBY Points";

/** 1 Point = ₦500 (top-up denomination and SMS points conversion divisor). */
export const NGN_MAJOR_PER_POINT = 500 as const;

/** 1 Point = 50_000 kobo. */
export const KOBO_PER_POINT = 50_000 as const;

/** Live SMS retail pricing algorithm version (persisted on orders). */
export const SMS_LIVE_PRICING_VERSION = "sms-live-v1" as const;

/** @deprecated fixed activation points — use retailKoboToPoints(retail) instead */
export const SMS_ACTIVATION_POINTS = 1 as const;

export const POINTS_PRICING_VERSION = SMS_LIVE_PRICING_VERSION;

export const POINTS_PER_LEDGER_MINOR = 1 as const;

export function minorToPoints(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error("Invalid amount");
  }
  return amountMinor * POINTS_PER_LEDGER_MINOR;
}

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

/** points × 50_000 kobo — integer only. */
export function pointsToKobo(points: number): number {
  assertPositivePoints(points);
  const product = BigInt(points) * BigInt(KOBO_PER_POINT);
  if (product > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Payment amount overflow");
  }
  return Number(product);
}

/** Exact inverse when kobo is a multiple of the point value. */
export function koboToPointsExact(kobo: number): number {
  if (!Number.isSafeInteger(kobo) || kobo <= 0) {
    throw new Error("Invalid kobo amount");
  }
  if (kobo % KOBO_PER_POINT !== 0) {
    throw new Error("Kobo amount is not an exact multiple of the point price");
  }
  return kobo / KOBO_PER_POINT;
}

/**
 * Points to debit for an SMS retail price in NGN kobo.
 * Always rounds up so SUBBY never undercharges.
 * ceil(retailKobo / 50_000)
 */
/**
 * Approximate package Points for UI (floor). Wallet truth is kobo.
 * 70_000 kobo → 1 Point package-equivalent (not used for debits).
 */
export function koboToPackagePoints(kobo: number): number {
  if (!Number.isSafeInteger(kobo) || kobo < 0) {
    throw new Error("Invalid kobo amount");
  }
  return Math.floor(kobo / KOBO_PER_POINT);
}

export function retailKoboToPoints(retailKobo: number): number {
  if (!Number.isSafeInteger(retailKobo) || retailKobo <= 0) {
    throw new Error("Invalid retail price");
  }
  const den = BigInt(KOBO_PER_POINT);
  const num = BigInt(retailKobo);
  const q = num / den;
  const r = num % den;
  const points = r === 0n ? q : q + 1n;
  if (points > BigInt(Number.MAX_SAFE_INTEGER) || points <= 0n) {
    throw new Error("Invalid points charge");
  }
  return Number(points);
}

export type LedgerEntryType =
  | "CREDIT"
  | "DEBIT"
  | "REFUND"
  | "ADMIN_ADJUSTMENT";

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

export function formatPoints(points: number): string {
  if (!Number.isSafeInteger(points)) return "0";
  return points.toLocaleString("en-US");
}

export function formatNgnFromKobo(kobo: number): string {
  if (!Number.isSafeInteger(kobo)) return "₦0";
  const major = Math.trunc(kobo / 100);
  return `₦${major.toLocaleString("en-US")}`;
}
