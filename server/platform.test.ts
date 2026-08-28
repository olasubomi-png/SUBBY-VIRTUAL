import { describe, expect, it } from "vitest";
import { providerRegistry } from "./providers";
import { ensureWallet } from "./persistence";
import { expireDemoResources } from "./jobs";
import { canReceiveResourceEvent, createRealtimeEvent } from "./realtime";

describe("platform foundations", () => {
  it("exposes only safe mock providers by default", async () => {
    providerRegistry.clearSmsCache();
    expect(providerRegistry.getSMS()).toBeDefined();
    expect(providerRegistry.getMail()).toBeDefined();
    const health = await providerRegistry.health({});
    expect(health.sms.ok).toBe(true);
    expect(health.mail.ok).toBe(true);
    expect(health.config.mode).toBe("mock");
  });

  it("keeps mock SMS provider as the safe default configuration", () => {
    const previousProvider = process.env.SMS_PROVIDER;
    const previousKey = process.env.SMS_PROVIDER_API_KEY;
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_PROVIDER_API_KEY;
    providerRegistry.clearSmsCache();
    const config = providerRegistry.validateConfiguration();
    expect(config.mode).toBe("mock");
    expect(providerRegistry.getSMS()).toBeDefined();
    if (previousProvider === undefined) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.SMS_PROVIDER_API_KEY;
    else process.env.SMS_PROVIDER_API_KEY = previousKey;
    providerRegistry.clearSmsCache();
  });

  it("rejects incomplete external SMS configuration without mock fallback", () => {
    expect(() =>
      providerRegistry.validateConfiguration({
        SMS_PROVIDER: "external",
        SMS_PROVIDER_API_KEY: "partial-only",
      })
    ).toThrow(/incomplete/);
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
