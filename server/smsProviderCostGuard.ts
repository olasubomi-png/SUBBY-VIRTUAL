
/**
 * Server-side provider cost ceiling for external activations.
 * Customer price remains 1 Point (₦500) — this only blocks unprofitable buys.
 */
import {
  maxProviderCostNgnToMinor,
  parseMaxProviderCostNgn,
  resolveSmsProviderConfig,
  type RuntimeEnv,
} from "./smsProviderConfig";
import { SmsProviderError } from "./smsProviderErrors";

/**
 * Assert provider cost is known and within SMS_MAX_PROVIDER_COST_NGN when set.
 * @param providerCostMinor — cost in wallet minor units (kobo after FX), from catalog
 * @param mode — active provider mode
 */
export function assertProviderCostAllowed(
  providerCostMinor: number | undefined | null,
  env: RuntimeEnv = process.env
): void {
  const config = resolveSmsProviderConfig(env);
  const maxNgn = config.maxProviderCostNgn;

  // External mode: require a known positive provider cost when a ceiling is set,
  // or when we must not invent prices — missing cost fails closed if ceiling set.
  if (config.mode === "external") {
    if (
      providerCostMinor === undefined ||
      providerCostMinor === null ||
      !Number.isSafeInteger(providerCostMinor) ||
      providerCostMinor < 0
    ) {
      if (maxNgn !== null) {
        throw new SmsProviderError(
          "PROVIDER_COST_EXCEEDED",
          "Provider cost is unavailable; cannot verify cost ceiling",
          { retryable: true }
        );
      }
      // No ceiling configured — allow allocation without cost check
      return;
    }
    if (maxNgn !== null) {
      const maxMinor = maxProviderCostNgnToMinor(maxNgn);
      if (providerCostMinor > maxMinor) {
        throw new SmsProviderError(
          "PROVIDER_COST_EXCEEDED",
          "Provider cost exceeds the configured maximum",
          { retryable: false }
        );
      }
    }
    return;
  }

  // Mock mode: optional ceiling still honored if set
  if (maxNgn !== null && providerCostMinor != null) {
    const maxMinor = maxProviderCostNgnToMinor(maxNgn);
    if (
      Number.isSafeInteger(providerCostMinor) &&
      providerCostMinor > maxMinor
    ) {
      throw new SmsProviderError(
        "PROVIDER_COST_EXCEEDED",
        "Provider cost exceeds the configured maximum",
        { retryable: false }
      );
    }
  }
}

export { parseMaxProviderCostNgn, maxProviderCostNgnToMinor };
