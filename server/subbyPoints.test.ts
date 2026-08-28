import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatPoints,
  isCreditEffect,
  minorToPoints,
  pointsToMinor,
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
  it("uses 1:1 identity with ledger minor units", () => {
    expect(minorToPoints(15000)).toBe(15000);
    expect(pointsToMinor(15000)).toBe(15000);
    expect(formatPoints(1250)).toBe("1,250");
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

  it("SMS purchase debits points equal to catalog retail price", async () => {
    seedDemoCreditsForTests(102, 50_000, "seed-102");
    const result = await createSmsOrder({
      userId: 102,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      provider: new MockSMSProvider(),
    });
    expect(result.priceMinor).toBe(15_000);
    expect(result.walletBalanceMinor).toBe(35_000);
  });

  it("allocation failure refunds points once", async () => {
    seedDemoCreditsForTests(103, 50_000, "seed-103");
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
    expect(getDemoWallet(103).balanceMinor).toBe(50_000);
  });
});
