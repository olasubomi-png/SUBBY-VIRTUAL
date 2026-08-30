import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatPoints,
  isCreditEffect,
  KOBO_PER_POINT,
  NGN_MAJOR_PER_POINT,
  minorToPoints,
  pointsToKobo,
  pointsToMinor,
  retailKoboToPoints,
} from "./subbyPoints";
import {
  addDemoCredits,
  debitDemoCredits,
  getDemoWallet,
  resetDemoState,
} from "./demoState";
import {
  createSmsOrder,
  seedDemoCreditsForTests,
} from "./smsOrders";
import { MockSMSProvider } from "./domain";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  resetDemoState();
});
afterEach(() => vi.unstubAllEnvs());

describe("SUBBY Points representation", () => {
  it("uses 1:1 identity with ledger units", () => {
    expect(minorToPoints(15)).toBe(15);
    expect(pointsToMinor(15)).toBe(15);
    expect(formatPoints(1250)).toBe("1,250");
  });

  it("prices 1 Point at ₦500 (50_000 kobo)", () => {
    expect(NGN_MAJOR_PER_POINT).toBe(500);
    expect(KOBO_PER_POINT).toBe(50_000);
        expect(pointsToKobo(1)).toBe(50_000);
    expect(pointsToKobo(2)).toBe(100_000);
    expect(pointsToKobo(5)).toBe(250_000);
    expect(pointsToKobo(10)).toBe(500_000);
    expect(pointsToKobo(20)).toBe(1_000_000);
    expect(pointsToKobo(100)).toBe(5_000_000);
  });

  it("converts retail kobo to Points with ceil", () => {
    expect(retailKoboToPoints(50_000)).toBe(1);
    expect(retailKoboToPoints(1)).toBe(1);
    expect(retailKoboToPoints(50_001)).toBe(2);
    expect(retailKoboToPoints(85_000)).toBe(2);
    expect(retailKoboToPoints(100_000)).toBe(2);
  });

  it("classifies ledger effects", () => {
    expect(isCreditEffect("CREDIT")).toBe(true);
    expect(isCreditEffect("REFUND")).toBe(true);
    expect(isCreditEffect("DEBIT")).toBe(false);
    expect(isCreditEffect("ADMIN_ADJUSTMENT", "credit")).toBe(true);
    expect(isCreditEffect("ADMIN_ADJUSTMENT", "debit")).toBe(false);
    expect(() => isCreditEffect("ADMIN_ADJUSTMENT")).toThrow();
  });
});

describe("points debit and refund", () => {
  it("prevents overspend on sequential debits", () => {
    addDemoCredits(100, 100, "seed-100");
    debitDemoCredits(100, 80, "spend A", "debit-a");
    expect(() =>
      debitDemoCredits(100, 80, "spend B", "debit-b")
    ).toThrow(/Insufficient/);
    expect(getDemoWallet(100).balanceMinor).toBe(20);
  });

  it("idempotent debit by reference does not double-charge", () => {
    addDemoCredits(101, 100, "seed-101");
    debitDemoCredits(101, 40, "once", "same-ref");
    debitDemoCredits(101, 40, "once", "same-ref");
    expect(getDemoWallet(101).balanceMinor).toBe(60);
  });

  it("SMS purchase debits Points derived from retail kobo", async () => {
    seedDemoCreditsForTests(102, 100_000, "seed-102");
    const result = await createSmsOrder({
      userId: 102,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      provider: new MockSMSProvider(),
    });
    expect(result.priceMinor).toBe(30_000);
    expect(result.walletBalanceMinor).toBe(70_000);
  });

  it("allocation failure refunds points once", async () => {
    seedDemoCreditsForTests(103, 100_000, "seed-103");
    const failing = {
      healthCheck: async () => ({ ok: true, detail: "ok" }),
      getCountries: async () => [{ code: "NG", name: "Nigeria" }],
      getServices: async () => [{ id: "whatsapp", name: "WhatsApp" }],
      getPricing: async () => [
        { serviceId: "whatsapp", amount: 15000, currency: "NGN" as const },
      ],
      buyActivation: async () => {
        throw new Error("fail");
      },
      getStatus: async () => ({ id: "x", status: "WAITING" as const }),
      cancelActivation: async () => undefined,
    };
    await expect(
      createSmsOrder({
        userId: 103,
        country: "NG",
        serviceId: "whatsapp",
        idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        provider: failing,
      })
    ).rejects.toThrow();
    expect(getDemoWallet(103).balanceMinor).toBe(100_000);
  });
});
