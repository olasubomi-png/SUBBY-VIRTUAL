
import { describe, expect, it, vi } from "vitest";
import {
  applyIsolatedSmsTestEnv,
  getSmsEnvSnapshot,
} from "./smsTestEnv";
import { resolveSmsProviderConfig } from "../smsProviderConfig";
import { getConfiguredSmsProvider } from "../providers";
import { MockSMSProvider } from "../domain";
import {
  clearSmsCatalogCache,
  resolvePriceQuote,
} from "../smsCatalog";
import { createSmsOrder, seedDemoCreditsForTests } from "../smsOrders";
import { resetDemoState } from "../demoState";

describe("SMS test environment isolation", () => {
  it("forces mock even when production external values are present on process.env", () => {
    // Simulate VPS production leakage
    process.env.SMS_PROVIDER = "external";
    process.env.SMS_PROVIDER_BASE_URL =
      "https://smsbulk.net/stubs/handler_api.php";
    process.env.SMS_PROVIDER_API_KEY = "prod-secret-must-not-be-used";
    process.env.SMS_MAX_PROVIDER_COST_NGN = "400";

    applyIsolatedSmsTestEnv();

    const snap = getSmsEnvSnapshot();
    expect(snap.SMS_PROVIDER).toBe("mock");
    expect(snap.SMS_PROVIDER_API_KEY).toBeUndefined();
    expect(snap.SMS_PROVIDER_BASE_URL).toBeUndefined();
    expect(snap.SMS_PROVIDER_API_KEY).not.toBe("prod-secret-must-not-be-used");

    const config = resolveSmsProviderConfig();
    expect(config.mode).toBe("mock");

    const provider = getConfiguredSmsProvider();
    expect(provider).toBeInstanceOf(MockSMSProvider);
  });

  it("survives vi.unstubAllEnvs when isolation is re-applied", () => {
    process.env.SMS_PROVIDER = "external";
    process.env.SMS_PROVIDER_API_KEY = "leaked";
    vi.stubEnv("DATABASE_URL", "");
    vi.unstubAllEnvs();
    // Production values may return; isolation must win
    applyIsolatedSmsTestEnv();
    expect(process.env.SMS_PROVIDER).toBe("mock");
    expect(process.env.SMS_PROVIDER_API_KEY).toBeUndefined();
  });

  it("keeps mock catalog pricing deterministic under isolation", async () => {
    applyIsolatedSmsTestEnv();
    clearSmsCatalogCache();
    resetDemoState();
    const quote = await resolvePriceQuote(
      new MockSMSProvider(),
      "NG",
      "whatsapp"
    );
    expect(quote.retailPriceMinor).toBe(30_000);
    expect(quote.available).toBe(true);
  });

  it("charges once under mock isolation (idempotency)", async () => {
    applyIsolatedSmsTestEnv();
    resetDemoState();
    seedDemoCreditsForTests(501, 10, "seed-501");
    const key = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const a = await createSmsOrder({
      userId: 501,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: key,
      provider: new MockSMSProvider(),
    });
    const b = await createSmsOrder({
      userId: 501,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: key,
      provider: new MockSMSProvider(),
    });
    expect(a.reused).toBe(false);
    expect(b.reused).toBe(true);
    expect(a.walletBalanceMinor).toBe(b.walletBalanceMinor);
  });
});
