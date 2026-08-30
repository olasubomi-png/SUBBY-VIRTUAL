
/**
 * Production money-flow proofs after Points → NGN-kobo ledger migration.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMarkupBps,
  DEFAULT_SMS_MARKUP_BPS,
  parseMarkupBps,
  markupAmountMinor,
} from "./smsPricing";
import { KOBO_PER_POINT, pointsToKobo } from "./subbyPoints";
import { getPointPackage } from "./pointPackages";
import {
  createSmsOrder,
  seedDemoCreditsForTests,
} from "./smsOrders";
import { MockSMSProvider } from "./domain";
import { getDemoWallet, resetDemoState } from "./demoState";
import { clearSmsCatalogCache } from "./smsCatalog";

afterEach(() => {
  resetDemoState();
  clearSmsCatalogCache();
  vi.unstubAllEnvs();
});

describe("48% markup (4800 BPS)", () => {
  it("matches DEFAULT_SMS_MARKUP_BPS", () => {
    expect(DEFAULT_SMS_MARKUP_BPS).toBe(4800);
    expect(parseMarkupBps(undefined)).toBe(4800);
  });

  it("₦100 → ₦148, ₦200 → ₦296, ₦500 → ₦740", () => {
    expect(applyMarkupBps(10_000, 4800)).toBe(14_800);
    expect(applyMarkupBps(20_000, 4800)).toBe(29_600);
    expect(applyMarkupBps(50_000, 4800)).toBe(74_000);
  });
});

describe("Paystack package amounts", () => {
  it("2 Points package is ₦1,000 = 100_000 kobo", () => {
    const pkg = getPointPackage("pts_2");
    expect(pkg.points).toBe(2);
    expect(pkg.amountMinor).toBe(100_000);
    expect(pkg.amountMinor).toBe(pointsToKobo(2));
    expect(pkg.ngnMajor).toBe(1_000);
  });
});

describe("₦1,000 fund → ₦300 SMS → ₦700 remaining", () => {
  it("debits exact retail kobo matching display", async () => {
    // Simulate verified Paystack credit of ₦1,000
    seedDemoCreditsForTests(7001, 100_000, "paystack-1000");
    expect(getDemoWallet(7001).balanceMinor).toBe(100_000);

    // Force catalog retail to 30_000 kobo (₦300) via mock + 0 markup
    vi.stubEnv("SMS_MARKUP_BPS", "0");
    const order = await createSmsOrder({
      userId: 7001,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "a0000000-0000-4000-8000-000000000001",
      provider: new MockSMSProvider(),
    });

    // Displayed retail === wallet debit
    expect(order.priceMinor).toBe(30_000);
    expect(order.walletBalanceMinor).toBe(70_000); // ₦700
    expect(order.priceMinor).toBe(30_000); // same field used for UI price
  });
});

describe("failed allocation refunds exact retail", () => {
  it("restores full debit after provider failure", async () => {
    seedDemoCreditsForTests(7002, 100_000, "seed-7002");
    vi.stubEnv("SMS_MARKUP_BPS", "0");
    const failing = {
      healthCheck: async () => ({ ok: true }),
      getCountries: async () => [{ code: "NG", name: "Nigeria" }],
      getServices: async () => [{ id: "whatsapp", name: "WhatsApp" }],
      getPricing: async () => [
        { serviceId: "whatsapp", amount: 30_000, currency: "NGN" as const },
      ],
      buyActivation: async () => {
        throw new Error("NO_NUMBERS");
      },
      getStatus: async () => ({ id: "x", status: "WAITING" as const }),
      cancelActivation: async () => undefined,
    };
    await expect(
      createSmsOrder({
        userId: 7002,
        country: "NG",
        serviceId: "whatsapp",
        idempotencyKey: "a0000000-0000-4000-8000-000000000002",
        provider: failing as unknown as MockSMSProvider,
      })
    ).rejects.toThrow();
    expect(getDemoWallet(7002).balanceMinor).toBe(100_000);
    const debits = getDemoWallet(7002).ledger.filter(e => e.type === "DEBIT");
    const refunds = getDemoWallet(7002).ledger.filter(
      e => e.type === "CREDIT" || e.type === "REFUND"
    );
    expect(debits.length).toBeGreaterThanOrEqual(1);
    // net zero after refund
    expect(getDemoWallet(7002).balanceMinor).toBe(100_000);
  });
});

describe("duplicate SMS idempotency", () => {
  it("charges wallet only once for the same idempotency key", async () => {
    seedDemoCreditsForTests(7003, 100_000, "seed-7003");
    vi.stubEnv("SMS_MARKUP_BPS", "0");
    const key = "a0000000-0000-4000-8000-000000000003";
    const a = await createSmsOrder({
      userId: 7003,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: key,
      provider: new MockSMSProvider(),
    });
    const b = await createSmsOrder({
      userId: 7003,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: key,
      provider: new MockSMSProvider(),
    });
    expect(a.reused).toBe(false);
    expect(b.reused).toBe(true);
    expect(a.walletBalanceMinor).toBe(b.walletBalanceMinor);
    expect(a.walletBalanceMinor).toBe(70_000);
    expect(
      getDemoWallet(7003).ledger.filter(e => e.type === "DEBIT")
    ).toHaveLength(1);
  });
});

describe("displayed retail equals debit (no ₦500 rounding)", () => {
  it("does not ceil ₦148 to ₦500", () => {
    const cost = 10_000;
    const retail = applyMarkupBps(cost, 4800);
    expect(retail).toBe(14_800);
    // Wallet now debits retail kobo, not ceil(retail/50000)*50000
    expect(retail).not.toBe(KOBO_PER_POINT);
    expect(markupAmountMinor(cost, retail)).toBe(4_800);
  });
});
