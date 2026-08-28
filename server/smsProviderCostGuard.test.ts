
import { describe, expect, it } from "vitest";
import { assertProviderCostAllowed } from "./smsProviderCostGuard";
import { SmsProviderError } from "./smsProviderErrors";

describe("assertProviderCostAllowed", () => {
  it("allows mock mode without ceiling", () => {
    expect(() =>
      assertProviderCostAllowed(1, { SMS_PROVIDER: "mock" })
    ).not.toThrow();
  });

  it("rejects when provider cost exceeds ceiling in external mode", () => {
    expect(() =>
      assertProviderCostAllowed(50_000, {
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
        SMS_PROVIDER_API_KEY: "key",
        SMS_MAX_PROVIDER_COST_NGN: "400",
      })
    ).toThrow(SmsProviderError);
    try {
      assertProviderCostAllowed(50_000, {
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
        SMS_PROVIDER_API_KEY: "key",
        SMS_MAX_PROVIDER_COST_NGN: "400",
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_COST_EXCEEDED" });
    }
  });

  it("allows provider cost below ceiling", () => {
    expect(() =>
      assertProviderCostAllowed(30_000, {
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
        SMS_PROVIDER_API_KEY: "key",
        SMS_MAX_PROVIDER_COST_NGN: "400",
      })
    ).not.toThrow();
  });

  it("fails closed when cost is missing and ceiling is set", () => {
    expect(() =>
      assertProviderCostAllowed(undefined, {
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
        SMS_PROVIDER_API_KEY: "key",
        SMS_MAX_PROVIDER_COST_NGN: "400",
      })
    ).toThrow(/unavailable|ceiling|cost/i);
  });

  it("allows missing cost when no ceiling configured", () => {
    expect(() =>
      assertProviderCostAllowed(undefined, {
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
        SMS_PROVIDER_API_KEY: "key",
      })
    ).not.toThrow();
  });
});
