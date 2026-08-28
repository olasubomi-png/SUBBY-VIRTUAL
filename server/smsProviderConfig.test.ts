import { afterEach, describe, expect, it } from "vitest";
import {
  describeSmsProviderConfig,
  isMockSmsProviderConfig,
  resolveSmsProviderConfig,
} from "./smsProviderConfig";
import { ExternalSmsProvider } from "./externalSmsProvider";
import {
  getConfiguredSmsProvider,
  providerRegistry,
} from "./providers";
import { MockSMSProvider } from "./domain";

afterEach(() => {
  providerRegistry.clearSmsCache();
});

describe("SMS provider configuration resolution", () => {
  it("defaults to mock when SMS_PROVIDER is unset", () => {
    const config = resolveSmsProviderConfig({});
    expect(config).toEqual({ mode: "mock" });
    expect(isMockSmsProviderConfig(config)).toBe(true);
  });

  it("selects mock when SMS_PROVIDER=mock", () => {
    const config = resolveSmsProviderConfig({ SMS_PROVIDER: "mock" });
    expect(config.mode).toBe("mock");
  });

  it("treats empty SMS_PROVIDER as mock", () => {
    expect(resolveSmsProviderConfig({ SMS_PROVIDER: "  " }).mode).toBe("mock");
  });

  it("rejects unknown provider names", () => {
    expect(() =>
      resolveSmsProviderConfig({ SMS_PROVIDER: "twilio-legacy" })
    ).toThrow(/Unknown SMS provider/);
  });

  it("rejects external mode without required configuration", () => {
    expect(() =>
      resolveSmsProviderConfig({ SMS_PROVIDER: "external" })
    ).toThrow(/incomplete/);
    expect(() =>
      resolveSmsProviderConfig({
        SMS_PROVIDER: "external",
        SMS_PROVIDER_API_KEY: "key-only",
      })
    ).toThrow(/SMS_PROVIDER_BASE_URL/);
    expect(() =>
      resolveSmsProviderConfig({
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      })
    ).toThrow(/SMS_PROVIDER_API_KEY/);
  });

  it("rejects invalid external base URLs", () => {
    expect(() =>
      resolveSmsProviderConfig({
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "not-a-url",
        SMS_PROVIDER_API_KEY: "secret",
      })
    ).toThrow(/valid http\(s\) URL/);
  });

  it("accepts complete external configuration without falling back to mock", () => {
    const config = resolveSmsProviderConfig({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com/v1/",
      SMS_PROVIDER_API_KEY: "test-key",
      SMS_PROVIDER_API_SECRET: "test-secret",
    });
    expect(config).toEqual({
      mode: "external",
      baseUrl: "https://sms.example.com/v1",
      apiKey: "test-key",
      apiSecret: "test-secret",
    });
    expect(isMockSmsProviderConfig(config)).toBe(false);
  });

  it("does not treat a lone API key as external mode", () => {
    // Partial credentials without SMS_PROVIDER=external stay on mock
    const config = resolveSmsProviderConfig({
      SMS_PROVIDER_API_KEY: "orphan-key",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
    });
    expect(config.mode).toBe("mock");
  });

  it("describes config without exposing secrets", () => {
    const summary = describeSmsProviderConfig({
      mode: "external",
      baseUrl: "https://sms.example.com",
      apiKey: "super-secret",
    });
    expect(summary).toEqual({ mode: "external", configured: true });
    expect(JSON.stringify(summary)).not.toContain("super-secret");
  });
});

describe("SMS provider registry selection", () => {
  it("returns MockSMSProvider by default", () => {
    const provider = getConfiguredSmsProvider({});
    expect(provider).toBeInstanceOf(MockSMSProvider);
  });

  it("returns MockSMSProvider when SMS_PROVIDER=mock even if keys are present", () => {
    const provider = getConfiguredSmsProvider({
      SMS_PROVIDER: "mock",
      SMS_PROVIDER_API_KEY: "ignored-key",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
    });
    expect(provider).toBeInstanceOf(MockSMSProvider);
  });

  it("rejects unknown provider through the registry", () => {
    expect(() =>
      getConfiguredSmsProvider({ SMS_PROVIDER: "not-a-provider" })
    ).toThrow(/Unknown SMS provider/);
  });

  it("does not initialize external provider without complete configuration", () => {
    expect(() =>
      getConfiguredSmsProvider({ SMS_PROVIDER: "external" })
    ).toThrow(/incomplete/);
    expect(() =>
      providerRegistry.validateConfiguration({
        SMS_PROVIDER: "external",
        SMS_PROVIDER_API_KEY: "only-key",
      })
    ).toThrow(/SMS_PROVIDER_BASE_URL/);
  });

  it("constructs ExternalSmsProvider when configuration is complete", () => {
    const provider = getConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "test-key",
    });
    expect(provider).toBeInstanceOf(ExternalSmsProvider);
  });

  it("external adapter methods fail closed without contacting a network", async () => {
    const provider = getConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "test-key",
    });
    await expect(provider.getCountries()).rejects.toThrow(/not implemented/);
    await expect(provider.getServices()).rejects.toThrow(/not implemented/);
    await expect(provider.getPricing()).rejects.toThrow(/not implemented/);
    await expect(
      provider.buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toThrow(/not implemented/);
    await expect(provider.getStatus("x")).rejects.toThrow(/not implemented/);
    await expect(provider.cancelActivation("x")).rejects.toThrow(
      /not implemented/
    );
    const health = await provider.healthCheck();
    expect(health.ok).toBe(false);
  });

  it("ExternalSmsProvider cannot be constructed with incomplete config", () => {
    expect(
      () =>
        new ExternalSmsProvider({
          mode: "external",
          baseUrl: "",
          apiKey: "",
        })
    ).toThrow(/cannot initialize without complete configuration/);
  });
});
