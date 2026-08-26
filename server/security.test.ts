import { describe, expect, it } from "vitest";
import { checkRateLimit, createAuditEvent } from "./security";

describe("security primitives", () => {
  it("limits a request bucket without blocking the first request", () => {
    expect(checkRateLimit("test-key", 2, 60_000)).toBe(true);
    expect(checkRateLimit("test-key", 2, 60_000)).toBe(true);
    expect(checkRateLimit("test-key", 2, 60_000)).toBe(false);
  });
  it("creates a structured audit event", () => {
    const event = createAuditEvent({
      actorId: 3,
      action: "request.created",
      targetType: "smsActivation",
      targetId: "activation_1",
    });
    expect(event).toMatchObject({
      actorId: 3,
      action: "request.created",
      targetType: "smsActivation",
    });
    expect(event.createdAt).toEqual(expect.any(String));
  });
});
