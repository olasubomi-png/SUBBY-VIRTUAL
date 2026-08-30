
import { afterEach, describe, expect, it } from "vitest";
import {
  KOBO_PER_POINT,
  NGN_MAJOR_PER_POINT,
  pointsToKobo,
  retailKoboToPoints,
} from "./subbyPoints";
import {
  applyMarkupBps,
  DEFAULT_SMS_MARKUP_BPS,
  parseMarkupBps,
} from "./smsPricing";
import { getPointPackage, listPointPackages } from "./pointPackages";
import { createSmsOrder, seedDemoCreditsForTests } from "./smsOrders";
import { MockSMSProvider } from "./domain";
import { getDemoWallet, resetDemoState } from "./demoState";
import { clearSmsCatalogCache } from "./smsCatalog";

afterEach(() => {
  resetDemoState();
  clearSmsCatalogCache();
});

describe("canonical unit mapping", () => {
  it("defines 1 Point = ₦500 = 50_000 kobo", () => {
    expect(NGN_MAJOR_PER_POINT).toBe(500);
    expect(KOBO_PER_POINT).toBe(50_000);
    expect(pointsToKobo(1)).toBe(50_000);
    expect(pointsToKobo(2)).toBe(100_000);
  });

  it("packages charge Paystack kobo equal to points × 50_000", () => {
    for (const pkg of listPointPackages()) {
      expect(pkg.amountMinor).toBe(pkg.points * KOBO_PER_POINT);
      expect(getPointPackage(pkg.id).amountMinor).toBe(pointsToKobo(pkg.points));
    }
  });
});

describe("SMS retail → points debit", () => {
  it("applies 48% then ceils to points", () => {
    const cost = 10_000; // ₦100
    const retail = applyMarkupBps(cost, 4800); // ₦148
    expect(retail).toBe(14_800);
    expect(retailKoboToPoints(retail)).toBe(1); // still 1 Point (₦500 bucket)
  });

  it("charges 2 points when retail exceeds ₦500", () => {
    const retail = applyMarkupBps(50_000, 4800); // ₦740
    expect(retail).toBe(74_000);
    expect(retailKoboToPoints(retail)).toBe(2);
  });
});

describe("top-up then SMS economic path (demo wallet)", () => {
  it("₦1000 (2 pts) top-up seeds then SMS debits expected points once", async () => {
    // Simulate ₦1000 Paystack → 2 points credit
    seedDemoCreditsForTests(9001, 2, "topup-1000");
    expect(getDemoWallet(9001).balanceMinor).toBe(2);

    process.env.SMS_MARKUP_BPS = "0"; // deterministic mock retail 30_000 kobo → 1 pt
    const order = await createSmsOrder({
      userId: 9001,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      provider: new MockSMSProvider(),
    });
    expect(order.priceMinor).toBe(1);
    expect(order.walletBalanceMinor).toBe(1);

    // Idempotent replay
    const replay = await createSmsOrder({
      userId: 9001,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      provider: new MockSMSProvider(),
    });
    expect(replay.reused).toBe(true);
    expect(getDemoWallet(9001).balanceMinor).toBe(1);
  });
});

describe("production markup default", () => {
  it("defaults SMS_MARKUP_BPS to 4800 when unset", () => {
    expect(DEFAULT_SMS_MARKUP_BPS).toBe(4800);
    expect(parseMarkupBps(undefined)).toBe(4800);
  });
});
