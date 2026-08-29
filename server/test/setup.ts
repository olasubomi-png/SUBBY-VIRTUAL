/**
 * Vitest global setup — isolate SMS (and related) env from production VPS .env.
 */
import { beforeEach } from "vitest";
import { applyIsolatedSmsTestEnv } from "./smsTestEnv";

// Apply once at module load so process.env is mock before any test imports resolve
applyIsolatedSmsTestEnv();

// Re-apply before every test so vi.unstubAllEnvs() cannot leak production SMS config
beforeEach(() => {
  applyIsolatedSmsTestEnv();
});
