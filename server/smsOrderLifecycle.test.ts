import { describe, expect, it } from "vitest";
import {
  assertSmsOrderTransition,
  canTransitionSmsOrder,
  isTerminalSmsOrderStatus,
  normalizeSmsOrderStatus,
  SMS_ORDER_STATUSES,
  toPublicSmsOrder,
  type SmsOrderRecord,
} from "./smsOrderLifecycle";

describe("SMS order lifecycle transitions", () => {
  it("allows the happy-path transitions", () => {
    expect(canTransitionSmsOrder("pending", "allocating")).toBe(true);
    expect(canTransitionSmsOrder("allocating", "active")).toBe(true);
    expect(canTransitionSmsOrder("active", "code_received")).toBe(true);
    expect(canTransitionSmsOrder("code_received", "completed")).toBe(true);
  });

  it("allows cancellation and expiration from non-terminal states", () => {
    for (const from of ["pending", "allocating", "active", "code_received"] as const) {
      expect(canTransitionSmsOrder(from, "cancelled")).toBe(true);
    }
    for (const from of ["pending", "allocating", "active"] as const) {
      expect(canTransitionSmsOrder(from, "expired")).toBe(true);
    }
  });

  it("rejects invalid and terminal transitions", () => {
    expect(canTransitionSmsOrder("pending", "completed")).toBe(false);
    expect(canTransitionSmsOrder("completed", "active")).toBe(false);
    expect(canTransitionSmsOrder("cancelled", "active")).toBe(false);
    expect(canTransitionSmsOrder("expired", "cancelled")).toBe(false);
    expect(canTransitionSmsOrder("failed", "pending")).toBe(false);
    expect(() => assertSmsOrderTransition("completed", "cancelled")).toThrow(
      /Invalid SMS order transition|terminal/
    );
    expect(() => assertSmsOrderTransition("active", "pending")).toThrow(
      /Invalid SMS order transition/
    );
  });

  it("marks terminal states correctly", () => {
    for (const status of ["completed", "cancelled", "expired", "failed"] as const) {
      expect(isTerminalSmsOrderStatus(status)).toBe(true);
    }
    expect(isTerminalSmsOrderStatus("active")).toBe(false);
  });

  it("normalizes legacy status strings", () => {
    expect(normalizeSmsOrderStatus("WAITING")).toBe("active");
    expect(normalizeSmsOrderStatus("ACTIVE")).toBe("active");
    expect(normalizeSmsOrderStatus("COMPLETED")).toBe("completed");
    expect(normalizeSmsOrderStatus("code_received")).toBe("code_received");
  });

  it("exposes the full status catalog", () => {
    expect(SMS_ORDER_STATUSES).toEqual(
      expect.arrayContaining([
        "pending",
        "allocating",
        "active",
        "code_received",
        "completed",
        "cancelled",
        "expired",
        "failed",
      ])
    );
  });

  it("redacts internal fields from public order payloads", () => {
    const order: SmsOrderRecord = {
      id: "ord_1",
      userId: 1,
      serviceId: "whatsapp",
      countryCode: "NG",
      priceMinor: 15000,
      currency: "NGN",
      status: "active",
      providerType: "MOCK",
      providerReference: "secret-provider-ref",
      phoneNumber: "+234 809 440 2186",
      verificationCode: null,
      idempotencyKey: "key",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
    const publicOrder = toPublicSmsOrder(order);
    expect(publicOrder).not.toHaveProperty("idempotencyKey");
    expect(publicOrder).not.toHaveProperty("providerReference");
    expect(publicOrder.providerMode).toBe("mock");
    expect(publicOrder.status).toBe("active");
  });
});
