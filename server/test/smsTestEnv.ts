/**
 * Central SMS test isolation.
 *
 * Production may set SMS_PROVIDER=external with real credentials in the process
 * environment. Automated tests must never contact that provider or depend on
 * live inventory/pricing.
 *
 * Call applyIsolatedSmsTestEnv() from Vitest setupFiles so every suite starts
 * with a deterministic mock configuration. Individual external-provider tests
 * must pass explicit env objects or fetch stubs — they must not rely on VPS .env.
 */

import { clearSmsCatalogCache } from "../smsCatalog";
import { clearConfiguredSmsProviderCache } from "../providers";

const SMS_ENV_KEYS = [
  "SMS_PROVIDER",
  "SMS_PROVIDER_BASE_URL",
  "SMS_PROVIDER_API_KEY",
  "SMS_PROVIDER_API_SECRET",
  "SMS_MARKUP_BPS",
  "SMS_FX_MINOR_PER_PROVIDER_MAJOR",
  "SMS_MAX_PROVIDER_COST_NGN",
] as const;

/**
 * Force mock SMS mode and clear live provider secrets from process.env.
 * Safe to call repeatedly (e.g. beforeEach).
 */
export function applyIsolatedSmsTestEnv(): void {
  process.env.SMS_PROVIDER = "mock";
  delete process.env.SMS_PROVIDER_BASE_URL;
  delete process.env.SMS_PROVIDER_API_KEY;
  delete process.env.SMS_PROVIDER_API_SECRET;
  // Deterministic markup/FX for mock catalog math unless a test overrides
  process.env.SMS_MARKUP_BPS = "0";
  delete process.env.SMS_FX_MINOR_PER_PROVIDER_MAJOR;
  delete process.env.SMS_MAX_PROVIDER_COST_NGN;

  try {
    clearSmsCatalogCache();
  } catch {
    // module may not be loaded yet during early setup
  }
  try {
    clearConfiguredSmsProviderCache();
  } catch {
    // optional
  }
}

/** Env snapshot for assertions in isolation regression tests. */
export function getSmsEnvSnapshot(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of SMS_ENV_KEYS) {
    out[key] = process.env[key];
  }
  return out;
}

export { SMS_ENV_KEYS };
