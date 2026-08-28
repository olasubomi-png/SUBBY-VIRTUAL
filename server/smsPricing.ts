/**
 * Integer-safe SMS pricing: provider cost → wallet minor units → retail.
 * No floating-point wallet math. Rounding: ceil toward the merchant (never undercharge).
 */

export type WalletCurrency = "NGN" | "USD";

/** Markup in basis points (100 bps = 1%). Default 0 = pass-through. */
export function parseMarkupBps(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100_000) {
    throw new Error(
      "SMS_MARKUP_BPS must be an integer between 0 and 100000 (basis points)"
    );
  }
  return n;
}

/**
 * FX rate: how many wallet minor units equal 1.00 of the provider major unit.
 * Example: provider quotes USD, wallet is NGN kobo, 1 USD = 1600 NGN
 * → rate = 1600 * 100 = 160000 kobo per USD.
 */
export function parseFxMinorPerProviderMajor(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    // Sensible default only used when external mode needs conversion; validated at config
    return 160_000;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000_000) {
    throw new Error(
      "SMS_FX_MINOR_PER_PROVIDER_MAJOR must be a positive integer (wallet minor units per 1.00 provider major)"
    );
  }
  return n;
}

/**
 * Parse provider major-unit price (e.g. "1.25" or 1.25) into integer cents
 * of the provider currency (2 decimal places). Rejects invalid values.
 */
export function providerMajorToCents(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Invalid provider price");
    }
    if (value === 0) throw new Error("Provider price must be positive");
    // Convert via fixed 2-dp string to avoid float artifacts
    const cents = Math.ceil(value * 100 - 1e-9);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new Error("Invalid provider price");
    }
    return cents;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
      throw new Error("Invalid provider price");
    }
    const [whole, frac = ""] = trimmed.split(".");
    const fracPadded = (frac + "00").slice(0, 2);
    const extra = frac.length > 2 ? frac.slice(2) : "";
    let cents = Number(whole) * 100 + Number(fracPadded);
    if (extra && Number(extra) > 0) cents += 1; // ceil residual digits
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new Error("Invalid provider price");
    }
    return cents;
  }
  throw new Error("Invalid provider price");
}

/**
 * Convert provider cost (cents of provider currency) to wallet minor units.
 * rate = wallet minor units per 1.00 provider major (= per 100 cents).
 * Uses ceil so we never under-reserve relative to FX.
 */
export function providerCentsToWalletMinor(
  providerCents: number,
  fxMinorPerProviderMajor: number
): number {
  if (!Number.isSafeInteger(providerCents) || providerCents <= 0) {
    throw new Error("Invalid provider cost");
  }
  if (!Number.isSafeInteger(fxMinorPerProviderMajor) || fxMinorPerProviderMajor <= 0) {
    throw new Error("Invalid FX rate");
  }
  // walletMinor = ceil(providerCents * rate / 100)
  const num = BigInt(providerCents) * BigInt(fxMinorPerProviderMajor);
  const den = 100n;
  const q = num / den;
  const r = num % den;
  const result = r === 0n ? q : q + 1n;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Price overflow");
  }
  const n = Number(result);
  if (n <= 0) throw new Error("Invalid converted price");
  return n;
}

/** Apply markup in basis points with ceil. */
export function applyMarkupBps(costMinor: number, markupBps: number): number {
  if (!Number.isSafeInteger(costMinor) || costMinor <= 0) {
    throw new Error("Invalid cost");
  }
  if (!Number.isSafeInteger(markupBps) || markupBps < 0) {
    throw new Error("Invalid markup");
  }
  // retail = ceil(cost * (10000 + markupBps) / 10000)
  const num = BigInt(costMinor) * BigInt(10_000 + markupBps);
  const den = 10_000n;
  const q = num / den;
  const r = num % den;
  const result = r === 0n ? q : q + 1n;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Price overflow");
  }
  const n = Number(result);
  if (n <= 0) throw new Error("Invalid retail price");
  return n;
}

export function computeRetailFromProviderMajor(
  providerMajor: unknown,
  fxMinorPerProviderMajor: number,
  markupBps: number
): { providerCostMinor: number; retailPriceMinor: number } {
  const cents = providerMajorToCents(providerMajor);
  const providerCostMinor = providerCentsToWalletMinor(
    cents,
    fxMinorPerProviderMajor
  );
  const retailPriceMinor = applyMarkupBps(providerCostMinor, markupBps);
  return { providerCostMinor, retailPriceMinor };
}
