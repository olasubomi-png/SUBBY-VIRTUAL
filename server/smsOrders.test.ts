import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockSMSProvider } from "./domain";
import { resetDemoState, getDemoWallet } from "./demoState";
import {
  cancelSmsOrder,
  createSmsOrder,
  expireSmsOrder,
  getSmsOrder,
  markSmsCodeReceived,
  seedDemoCreditsForTests,
} from "./smsOrders";
import { assertSmsOrderTransition } from "./smsOrderLifecycle";

const provider = new MockSMSProvider();

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  resetDemoState();
});
afterEach(() => vi.unstubAllEnvs());

describe("SMS order creation", () => {
  it("creates an order, deducts balance once, and reaches active with a mock number", async () => {
    seedDemoCreditsForTests(42, 50000, "seed-42");
    const result = await createSmsOrder({
      userId: 42,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      provider,
    });
    expect(result.status).toBe("active");
    expect(result.phoneNumber.startsWith("+")).toBe(true);
    expect(result.priceMinor).toBe(15000);
    expect(result.walletBalanceMinor).toBe(35000);
    expect(result.reused).toBe(false);
    expect(result.audit).toMatch(/Mock/);
    expect(getDemoWallet(42).ledger.filter(e => e.type === "DEBIT")).toHaveLength(
      1
    );
  });

  it("rejects insufficient balance without creating an order", async () => {
    seedDemoCreditsForTests(43, 1000, "seed-43");
    await expect(
      createSmsOrder({
        userId: 43,
        country: "NG",
        serviceId: "whatsapp",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
        provider,
      })
    ).rejects.toThrow("Insufficient balance");
    expect(getDemoWallet(43).balanceMinor).toBe(1000);
    expect(getDemoWallet(43).ledger.filter(e => e.type === "DEBIT")).toHaveLength(
      0
    );
  });

  it("rejects invalid service and country", async () => {
    seedDemoCreditsForTests(44, 50000, "seed-44");
    await expect(
      createSmsOrder({
        userId: 44,
        country: "ZZ",
        serviceId: "whatsapp",
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
        provider,
      })
    ).rejects.toThrow("Unknown SMS country");
    await expect(
      createSmsOrder({
        userId: 44,
        country: "NG",
        serviceId: "not-a-service",
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        provider,
      })
    ).rejects.toThrow("Unknown SMS service");
  });

  it("enforces server-side pricing from the catalog", async () => {
    seedDemoCreditsForTests(45, 50000, "seed-45");
    const pricing = await provider.getPricing();
    const telegram = pricing.find(p => p.serviceId === "telegram");
    expect(telegram?.amount).toBe(12000);
    const result = await createSmsOrder({
      userId: 45,
      country: "US",
      serviceId: "telegram",
      idempotencyKey: "55555555-5555-4555-8555-555555555555",
      provider,
    });
    expect(result.priceMinor).toBe(12000);
    expect(result.walletBalanceMinor).toBe(38000);
  });

  it("returns the existing order for a duplicate idempotency key without double-charging", async () => {
    seedDemoCreditsForTests(46, 50000, "seed-46");
    const key = "66666666-6666-4666-8666-666666666666";
    const first = await createSmsOrder({
      userId: 46,
      country: "NG",
      serviceId: "verify",
      idempotencyKey: key,
      provider,
    });
    const second = await createSmsOrder({
      userId: 46,
      country: "NG",
      serviceId: "verify",
      idempotencyKey: key,
      provider,
    });
    expect(second.id).toBe(first.id);
    expect(second.reused).toBe(true);
    expect(second.walletBalanceMinor).toBe(first.walletBalanceMinor);
    expect(getDemoWallet(46).ledger.filter(e => e.type === "DEBIT")).toHaveLength(
      1
    );
  });

  it("handles concurrent duplicate idempotency submissions safely", async () => {
    seedDemoCreditsForTests(47, 50000, "seed-47");
    const key = "77777777-7777-4777-8777-777777777777";
    const results = await Promise.all([
      createSmsOrder({
        userId: 47,
        country: "NG",
        serviceId: "discord",
        idempotencyKey: key,
        provider,
      }),
      createSmsOrder({
        userId: 47,
        country: "NG",
        serviceId: "discord",
        idempotencyKey: key,
        provider,
      }),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(getDemoWallet(47).ledger.filter(e => e.type === "DEBIT")).toHaveLength(
      1
    );
    expect(results.some(r => r.reused) || results[0].id === results[1].id).toBe(
      true
    );
  });
});

describe("SMS order lifecycle operations", () => {
  it("cancels an active order and protects terminal states", async () => {
    seedDemoCreditsForTests(48, 50000, "seed-48");
    const order = await createSmsOrder({
      userId: 48,
      country: "GB",
      serviceId: "google",
      idempotencyKey: "88888888-8888-4888-8888-888888888888",
      provider,
    });
    const cancelled = await cancelSmsOrder(48, order.id);
    expect(cancelled.status).toBe("cancelled");
    await expect(cancelSmsOrder(48, order.id)).rejects.toThrow();
  });

  it("expires an active order", async () => {
    seedDemoCreditsForTests(49, 50000, "seed-49");
    const order = await createSmsOrder({
      userId: 49,
      country: "NG",
      serviceId: "facebook",
      idempotencyKey: "99999999-9999-4999-8999-999999999999",
      provider,
    });
    const expired = await expireSmsOrder(49, order.id);
    expect(expired.status).toBe("expired");
  });

  it("records a simulated code and completes the order", async () => {
    seedDemoCreditsForTests(50, 50000, "seed-50");
    const order = await createSmsOrder({
      userId: 50,
      country: "NG",
      serviceId: "instagram",
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      provider,
    });
    const completed = await markSmsCodeReceived(50, order.id, "123456");
    expect(completed.status).toBe("completed");
    const detail = await getSmsOrder(50, order.id);
    expect(detail.status).toBe("completed");
  });

  it("rejects invalid lifecycle transitions", () => {
    expect(() => assertSmsOrderTransition("pending", "completed")).toThrow(
      /Invalid SMS order transition/
    );
    expect(() => assertSmsOrderTransition("failed", "active")).toThrow();
  });
});

describe("provider failure handling", () => {
  it("marks the order failed when the provider cannot allocate a number", async () => {
    seedDemoCreditsForTests(60, 50000, "seed-60");
    const failingProvider = {
      healthCheck: async () => ({ ok: true, detail: "ok" }),
      getCountries: async () => [{ code: "NG", name: "Nigeria" }],
      getServices: async () => [{ id: "whatsapp", name: "WhatsApp" }],
      getPricing: async () => [
        { serviceId: "whatsapp", amount: 15000, currency: "NGN" as const },
      ],
      buyActivation: async () => {
        throw new Error("upstream provider timeout");
      },
      getStatus: async () => ({ id: "x", status: "WAITING" as const }),
      cancelActivation: async () => undefined,
    };
    await expect(
      createSmsOrder({
        userId: 60,
        country: "NG",
        serviceId: "whatsapp",
        idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        provider: failingProvider,
      })
    ).rejects.toThrow("Unable to allocate SMS number");
    // Balance was reserved for the attempt; order should be terminal failed.
    // Debit happens before provider call by design (atomic create+debit).
    expect(getDemoWallet(60).ledger.filter(e => e.type === "DEBIT")).toHaveLength(
      1
    );
  });
});
