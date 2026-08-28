import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalSmsProviderType,
  canonicalSmsProviderTypeFromConfig,
  describeSmsProviderConfig,
  isMockSmsProviderConfig,
  resolveSmsProviderConfig,
} from "./smsProviderConfig";
import { ExternalSmsProvider } from "./externalSmsProvider";
import {
  getConfiguredSmsProvider,
  providerRegistry,
  resolveConfiguredSmsProvider,
} from "./providers";
import { MockSMSProvider } from "./domain";

afterEach(() => {
  providerRegistry.clearSmsCache();
});

describe("SMS provider configuration resolution", () => {
  it("defaults to mock when SMS_PROVIDER is unset", () => {
    const config = resolveSmsProviderConfig({});
    expect(config).toEqual({ mode: "mock", maxProviderCostNgn: null });
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
      maxProviderCostNgn: null,
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
      maxProviderCostNgn: null,
    });
    expect(summary).toEqual({ mode: "external", configured: true, maxProviderCostNgn: null });
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

  it("external adapter fails closed on network ops without a live upstream", async () => {
    const provider = getConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.invalid",
      SMS_PROVIDER_API_KEY: "test-key",
    });
    // Local mapping still works offline
    await expect(provider.getCountries()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "NG" })])
    );
    await expect(provider.getServices()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "whatsapp" })])
    );
    // Live pricing is empty at the provider interface — catalog service is authoritative
    await expect(provider.getPricing()).resolves.toEqual([]);
    // Network operations fail closed (unreachable host)
    await expect(
      provider.buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toThrow();
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
          maxProviderCostNgn: null,
        })
    ).toThrow(/cannot initialize without complete configuration/);
  });
});

describe("provider type consistency with resolved configuration", () => {
  it("maps mock mode to canonical MOCK provider type", () => {
    expect(canonicalSmsProviderType("mock")).toBe("MOCK");
    const resolved = resolveConfiguredSmsProvider({ SMS_PROVIDER: "mock" });
    expect(resolved.provider).toBeInstanceOf(MockSMSProvider);
    expect(resolved.providerType).toBe("MOCK");
    expect(resolved.providerType).toBe(
      canonicalSmsProviderTypeFromConfig(resolved.config)
    );
  });

  it("maps external mode to canonical EXTERNAL provider type", () => {
    expect(canonicalSmsProviderType("external")).toBe("EXTERNAL");
    const resolved = resolveConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "test-key",
    });
    expect(resolved.provider).toBeInstanceOf(ExternalSmsProvider);
    expect(resolved.providerType).toBe("EXTERNAL");
    expect(resolved.providerType).toBe(
      canonicalSmsProviderTypeFromConfig(resolved.config)
    );
  });

  it("keeps provider instance and providerType aligned for the same config", () => {
    const mock = resolveConfiguredSmsProvider({});
    expect(mock.config.mode).toBe("mock");
    expect(mock.providerType).toBe("MOCK");
    expect(mock.provider).toBeInstanceOf(MockSMSProvider);

    const external = resolveConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "key-a",
    });
    expect(external.config.mode).toBe("external");
    expect(external.providerType).toBe("EXTERNAL");
    expect(external.provider).toBeInstanceOf(ExternalSmsProvider);

    // Provider metadata cannot silently disagree with the selected mode
    expect(
      (external.providerType === "EXTERNAL") ===
        (external.config.mode === "external")
    ).toBe(true);
    expect(
      (mock.providerType === "MOCK") === (mock.config.mode === "mock")
    ).toBe(true);
  });

  it("does not reuse a cached provider when external credentials change", () => {
    providerRegistry.clearSmsCache();
    const first = getConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "key-one",
    });
    const second = getConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "key-two",
    });
    expect(first).not.toBe(second);
    expect(first).toBeInstanceOf(ExternalSmsProvider);
    expect(second).toBeInstanceOf(ExternalSmsProvider);

    // Same credentials of equal length previously collided; must still differ
    const sameLenA = getConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "aaaaaaaa",
    });
    const sameLenB = getConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "bbbbbbbb",
    });
    expect(sameLenA).not.toBe(sameLenB);
  });

  it("reuses the cached provider only for identical configuration", () => {
    providerRegistry.clearSmsCache();
    const env = {
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com",
      SMS_PROVIDER_API_KEY: "stable-key",
    };
    const a = getConfiguredSmsProvider(env);
    const b = getConfiguredSmsProvider(env);
    expect(a).toBe(b);
  });
});


describe("SMS_MAX_PROVIDER_COST_NGN", () => {
  it("parses null by default and integer ceilings", () => {
    expect(resolveSmsProviderConfig({}).maxProviderCostNgn).toBeNull();
    expect(
      resolveSmsProviderConfig({ SMS_MAX_PROVIDER_COST_NGN: "400" })
        .maxProviderCostNgn
    ).toBe(400);
    expect(() =>
      resolveSmsProviderConfig({ SMS_MAX_PROVIDER_COST_NGN: "-1" })
    ).toThrow(/SMS_MAX_PROVIDER_COST_NGN/);
  });
});
