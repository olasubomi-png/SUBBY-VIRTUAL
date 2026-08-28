import { describe, expect, it } from "vitest";
import {
  assertSmsOrderTransition,
  assertSmsOrderTransitionFromRaw,
  canTransitionSmsOrder,
  isCancellableSmsOrderStatus,
  isCodeEligibleSmsOrderStatus,
  isExpirableSmsOrderStatus,
  isSimulatableSmsOrderStatus,
  isTerminalSmsOrderStatus,
  normalizeSmsOrderStatus,
  SMS_ORDER_STATUSES,
  SMS_ORDER_TRANSITIONS,
  toPublicSmsOrder,
  type SmsOrderRecord,
  type SmsOrderStatus,
} from "./smsOrderLifecycle";

describe("SMS order canonical catalog", () => {
  it("exposes only lowercase canonical states", () => {
    expect([...SMS_ORDER_STATUSES]).toEqual([
      "pending",
      "allocating",
      "active",
      "code_received",
      "completed",
      "cancelled",
      "expired",
      "failed",
    ]);
    for (const status of SMS_ORDER_STATUSES) {
      expect(status).toBe(status.toLowerCase());
      expect(status).not.toMatch(/[A-Z]/);
    }
  });
});

describe("SMS order valid transitions", () => {
  const required: Array<[SmsOrderStatus, SmsOrderStatus]> = [
    ["pending", "allocating"],
    ["allocating", "active"],
    ["allocating", "failed"],
    ["active", "code_received"],
    ["active", "cancelled"],
    ["active", "expired"],
    ["code_received", "completed"],
    ["code_received", "cancelled"],
    ["code_received", "expired"],
  ];

  it("allows every required transition", () => {
    for (const [from, to] of required) {
      expect(canTransitionSmsOrder(from, to)).toBe(true);
      expect(() => assertSmsOrderTransition(from, to)).not.toThrow();
    }
  });

  it("enumerates the full transition table without gaps", () => {
    expect(SMS_ORDER_TRANSITIONS.pending).toEqual(
      expect.arrayContaining(["allocating", "cancelled", "expired", "failed"])
    );
    expect(SMS_ORDER_TRANSITIONS.allocating).toEqual(
      expect.arrayContaining(["active", "failed"])
    );
    expect(SMS_ORDER_TRANSITIONS.active).toEqual(
      expect.arrayContaining(["code_received", "cancelled", "expired"])
    );
    expect(SMS_ORDER_TRANSITIONS.code_received).toEqual(
      expect.arrayContaining(["completed", "cancelled", "expired"])
    );
    for (const terminal of ["completed", "cancelled", "expired", "failed"] as const) {
      expect(SMS_ORDER_TRANSITIONS[terminal]).toEqual([]);
    }
  });
});

describe("SMS order invalid and terminal transitions", () => {
  it("rejects invalid transitions", () => {
    expect(canTransitionSmsOrder("pending", "completed")).toBe(false);
    expect(canTransitionSmsOrder("pending", "active")).toBe(false);
    expect(canTransitionSmsOrder("active", "pending")).toBe(false);
    expect(canTransitionSmsOrder("active", "allocating")).toBe(false);
    expect(canTransitionSmsOrder("code_received", "active")).toBe(false);
    expect(canTransitionSmsOrder("code_received", "failed")).toBe(false);
    expect(() => assertSmsOrderTransition("pending", "completed")).toThrow(
      /Invalid SMS order transition: pending → completed/
    );
  });

  it("protects terminal states from further modification", () => {
    for (const terminal of ["completed", "cancelled", "expired", "failed"] as const) {
      expect(isTerminalSmsOrderStatus(terminal)).toBe(true);
      expect(() => assertSmsOrderTransition(terminal, "active")).toThrow(
        /terminal/
      );
      expect(() => assertSmsOrderTransition(terminal, "cancelled")).toThrow(
        /terminal/
      );
    }
    expect(isTerminalSmsOrderStatus("active")).toBe(false);
  });
});

describe("legacy status normalization at the boundary", () => {
  it("maps legacy uppercase values to canonical states", () => {
    expect(normalizeSmsOrderStatus("WAITING")).toBe("active");
    expect(normalizeSmsOrderStatus("ACTIVE")).toBe("active");
    expect(normalizeSmsOrderStatus("MESSAGE_RECEIVED")).toBe("code_received");
    expect(normalizeSmsOrderStatus("COMPLETED")).toBe("completed");
    expect(normalizeSmsOrderStatus("CANCELLED")).toBe("cancelled");
    expect(normalizeSmsOrderStatus("EXPIRED")).toBe("expired");
    expect(normalizeSmsOrderStatus("FAILED")).toBe("failed");
  });

  it("passes through canonical values unchanged", () => {
    for (const status of SMS_ORDER_STATUSES) {
      expect(normalizeSmsOrderStatus(status)).toBe(status);
    }
  });

  it("asserts transitions after normalizing legacy source status", () => {
    expect(assertSmsOrderTransitionFromRaw("ACTIVE", "code_received")).toBe(
      "active"
    );
    expect(assertSmsOrderTransitionFromRaw("WAITING", "cancelled")).toBe(
      "active"
    );
    expect(() =>
      assertSmsOrderTransitionFromRaw("COMPLETED", "active")
    ).toThrow(/terminal/);
    expect(() =>
      assertSmsOrderTransitionFromRaw("ACTIVE", "pending")
    ).toThrow(/Invalid SMS order transition/);
  });

  it("rejects unknown status strings", () => {
    expect(() => normalizeSmsOrderStatus("bogus")).toThrow(
      /Unknown SMS order status/
    );
  });
});

describe("status capability helpers", () => {
  it("classifies simulatable, cancellable, and expirable states", () => {
    expect(isSimulatableSmsOrderStatus("active")).toBe(true);
    expect(isSimulatableSmsOrderStatus("pending")).toBe(false);
    expect(isCodeEligibleSmsOrderStatus("active")).toBe(true);
    expect(isCodeEligibleSmsOrderStatus("code_received")).toBe(true);
    expect(isCodeEligibleSmsOrderStatus("completed")).toBe(false);
    expect(isCancellableSmsOrderStatus("active")).toBe(true);
    expect(isCancellableSmsOrderStatus("completed")).toBe(false);
    expect(isExpirableSmsOrderStatus("active")).toBe(true);
    expect(isExpirableSmsOrderStatus("code_received")).toBe(true);
    expect(isExpirableSmsOrderStatus("completed")).toBe(false);
  });
});

describe("public order shaping", () => {
  it("exposes canonical status and redacts internal fields", () => {
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
