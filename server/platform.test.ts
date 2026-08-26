import { describe, expect, it } from "vitest";
import { providerRegistry } from "./providers";
import { ensureWallet } from "./persistence";
import { expireDemoResources } from "./jobs";
import { canReceiveResourceEvent, createRealtimeEvent } from "./realtime";

describe("platform foundations", () => {
  it("exposes only safe mock providers by default", async () => {
    expect(providerRegistry.getSMS()).toBeDefined();
    expect(providerRegistry.getMail()).toBeDefined();
    const health = await providerRegistry.health();
    expect(health.sms[0]?.mode).toBe("mock");
    expect(health.mail[0]?.mode).toBe("mock");
  });

  it("rejects production provider credentials during Phase 1", () => {
    const previous = process.env.SMS_PROVIDER_API_KEY;
    process.env.SMS_PROVIDER_API_KEY = "disabled-test-key";
    expect(() => providerRegistry.validateConfiguration()).toThrow(
      "disabled in Phase 1"
    );
    if (previous === undefined) delete process.env.SMS_PROVIDER_API_KEY;
    else process.env.SMS_PROVIDER_API_KEY = previous;
  });

  it("fails persistence helpers clearly when PostgreSQL is not configured", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    await expect(ensureWallet(1)).rejects.toThrow(
      "DATABASE_URL is not configured"
    );
    expect(await expireDemoResources()).toEqual({ inboxes: 0, activations: 0 });
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  });

  it("restricts realtime resource events to owners or admins", () => {
    expect(
      canReceiveResourceEvent({
        viewerId: 2,
        viewerRole: "user",
        ownerId: 1,
        event: "wallet.updated",
      })
    ).toBe(false);
    expect(
      canReceiveResourceEvent({
        viewerId: 1,
        viewerRole: "user",
        ownerId: 1,
        event: "wallet.updated",
      })
    ).toBe(true);
    expect(
      canReceiveResourceEvent({
        viewerId: 2,
        viewerRole: "admin",
        ownerId: 1,
        event: "wallet.updated",
      })
    ).toBe(true);
    expect(
      createRealtimeEvent("activation.created", 1, { id: "a1" }).ownerId
    ).toBe(1);
  });
});
