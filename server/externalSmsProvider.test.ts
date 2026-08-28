import { afterEach, describe, expect, it } from "vitest";
import { ExternalSmsProvider } from "./externalSmsProvider";
import { SmsProviderError } from "./smsProviderErrors";
import {
  mapCountryToProviderId,
  mapProviderStatusText,
  mapServiceToProviderCode,
  providerStatusToCanonicalTarget,
} from "./smsProviderMapping";
import {
  getConfiguredSmsProvider,
  providerRegistry,
  resolveConfiguredSmsProvider,
} from "./providers";
import { MockSMSProvider } from "./domain";

afterEach(() => providerRegistry.clearSmsCache());

function mockFetch(handler: (url: string) => { status?: number; body: string }) {
  return async (input: string) => {
    const result = handler(input);
    return {
      ok: (result.status ?? 200) >= 200 && (result.status ?? 200) < 300,
      status: result.status ?? 200,
      text: async () => result.body,
    } as Response;
  };
}

function providerWith(
  handler: (url: string) => { status?: number; body: string }
) {
  return new ExternalSmsProvider(
    {
      mode: "external",
      maxProviderCostNgn: null,
      baseUrl: "https://sms.example.com/stubs/handler_api.php",
      apiKey: "test-secret-key",
    },
    { fetchImpl: mockFetch(handler), timeoutMs: 2000 }
  );
}

describe("SMS-Activate compatible mapping", () => {
  it("maps services and countries", () => {
    expect(mapServiceToProviderCode("whatsapp")).toBe("wa");
    expect(mapServiceToProviderCode("telegram")).toBe("tg");
    expect(mapCountryToProviderId("NG")).toBe(19);
    expect(mapCountryToProviderId("US")).toBe(12);
  });

  it("maps provider status text to canonical targets", () => {
    expect(mapProviderStatusText("STATUS_WAIT_CODE")).toEqual({
      status: "WAITING",
    });
    expect(mapProviderStatusText("STATUS_OK:482913")).toEqual({
      status: "RECEIVED",
      code: "482913",
    });
    expect(mapProviderStatusText("STATUS_CANCEL")).toEqual({
      status: "CANCELLED",
    });
    expect(providerStatusToCanonicalTarget("RECEIVED")).toBe("code_received");
    expect(providerStatusToCanonicalTarget("CANCELLED")).toBe("cancelled");
    expect(providerStatusToCanonicalTarget("WAITING")).toBeNull();
  });
});

describe("ExternalSmsProvider HTTP adapter", () => {
  it("reports healthy balance without exposing secrets", async () => {
    const provider = providerWith(url => {
      expect(url).toContain("api_key=test-secret-key");
      expect(url).toContain("action=getBalance");
      return { body: "ACCESS_BALANCE:42.5" };
    });
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.balanceMajor).toBe(42.5);
    expect(JSON.stringify(health)).not.toContain("test-secret-key");
  });

  it("allocates a number and returns provider reference", async () => {
    const provider = providerWith(url => {
      expect(url).toContain("action=getNumber");
      expect(url).toContain("service=wa");
      expect(url).toContain("country=19");
      return { body: "ACCESS_NUMBER:987654:+2348094402186" };
    });
    const result = await provider.buyActivation({
      userId: 1,
      country: "NG",
      serviceId: "whatsapp",
    });
    expect(result).toEqual({
      id: "987654",
      phoneNumber: "+2348094402186",
      status: "WAITING",
    });
  });

  it("maps no-numbers and auth failures", async () => {
    await expect(
      providerWith(() => ({ body: "NO_NUMBERS" })).buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_NO_NUMBERS" });

    await expect(
      providerWith(() => ({ body: "BAD_KEY" })).buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_AUTH" });
  });

  it("handles HTTP 401 and 500 safely", async () => {
    await expect(
      providerWith(() => ({ status: 401, body: "denied" })).healthCheck()
    ).resolves.toMatchObject({ ok: false });

    await expect(
      providerWith(() => ({ status: 500, body: "err" })).buyActivation({
        userId: 1,
        country: "US",
        serviceId: "telegram",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("handles malformed allocation responses", async () => {
    await expect(
      providerWith(() => ({ body: "ACCESS_NUMBER:only-id" })).buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_MALFORMED" });
  });

  it("reads verification codes from getStatus", async () => {
    const provider = providerWith(url => {
      expect(url).toContain("action=getStatus");
      expect(url).toContain("id=987654");
      return { body: "STATUS_OK:123456" };
    });
    const status = await provider.getStatus("987654");
    expect(status).toEqual({
      id: "987654",
      status: "RECEIVED",
      code: "123456",
    });
  });

  it("cancels activations idempotently", async () => {
    const provider = providerWith(url => {
      expect(url).toContain("action=setStatus");
      expect(url).toContain("status=8");
      return { body: "ACCESS_CANCEL" };
    });
    await expect(provider.cancelActivation("987654")).resolves.toBeUndefined();
  });

  it("times out and maps to PROVIDER_TIMEOUT", async () => {
    const provider = new ExternalSmsProvider(
      {
        mode: "external",
        maxProviderCostNgn: null,
        baseUrl: "https://sms.example.com/api",
        apiKey: "key",
      },
      {
        timeoutMs: 20,
        fetchImpl: () =>
          new Promise((_resolve, reject) => {
            const err = new Error("aborted");
            err.name = "AbortError";
            setTimeout(() => reject(err), 5);
          }),
      }
    );
    await expect(
      provider.buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("redacts api keys from URLs", () => {
    const redacted = ExternalSmsProvider.redactForTests(
      "https://sms.example.com/api?api_key=super-secret&action=getBalance"
    );
    expect(redacted).toContain("api_key=%5Bredacted%5D");
    expect(redacted).not.toContain("super-secret");
  });
});

describe("registry selection with external adapter", () => {
  it("still defaults to mock", () => {
    expect(getConfiguredSmsProvider({})).toBeInstanceOf(MockSMSProvider);
  });

  it("constructs external provider when configured", () => {
    const resolved = resolveConfiguredSmsProvider({
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
      SMS_PROVIDER_API_KEY: "key",
    });
    expect(resolved.provider).toBeInstanceOf(ExternalSmsProvider);
    expect(resolved.providerType).toBe("EXTERNAL");
  });

  it("fails closed without configuration", () => {
    expect(() =>
      getConfiguredSmsProvider({ SMS_PROVIDER: "external" })
    ).toThrow(/incomplete/);
  });
});

describe("SmsProviderError safety", () => {
  it("never puts secrets into error messages", () => {
    const error = new SmsProviderError(
      "PROVIDER_AUTH",
      "Invalid provider API key"
    );
    expect(error.message).not.toMatch(/api[_-]?key/i);
    expect(error.message).not.toContain("secret");
  });
});


describe("ExternalSmsProvider HTTP error matrix", () => {
  function providerWith(
    handler: (url: string) => { status?: number; body: string }
  ) {
    return new ExternalSmsProvider(
      {
        mode: "external",
        maxProviderCostNgn: null,
        baseUrl: "https://sms.example.com/stubs/handler_api.php",
        apiKey: "test-secret-key",
      },
      {
        fetchImpl: async (input: string) => {
          const result = handler(input);
          return {
            ok: (result.status ?? 200) >= 200 && (result.status ?? 200) < 300,
            status: result.status ?? 200,
            text: async () => result.body,
          } as Response;
        },
        timeoutMs: 2000,
      }
    );
  }

  it("maps NO_BALANCE to PROVIDER_INSUFFICIENT_BALANCE", async () => {
    await expect(
      providerWith(() => ({ body: "NO_BALANCE" })).buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_INSUFFICIENT_BALANCE" });
  });

  it("maps HTTP 403 to PROVIDER_AUTH", async () => {
    await expect(
      providerWith(() => ({ status: 403, body: "forbidden" })).buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_AUTH" });
  });

  it("maps HTTP 429 to PROVIDER_RATE_LIMITED", async () => {
    await expect(
      providerWith(() => ({ status: 429, body: "slow down" })).buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMITED" });
  });

  it("parses STATUS_WAIT_CODE as waiting", async () => {
    const status = await providerWith(() => ({
      body: "STATUS_WAIT_CODE",
    })).getStatus("123");
    expect(status.status).toBe("WAITING");
  });

  it("parses STATUS_CANCEL", async () => {
    const status = await providerWith(() => ({
      body: "STATUS_CANCEL",
    })).getStatus("123");
    expect(status.status).toBe("CANCELLED");
  });

  it("rejects malformed balance responses in healthCheck", async () => {
    const health = await providerWith(() => ({
      body: "ACCESS_BALANCE:not-a-number",
    })).healthCheck();
    expect(health.ok).toBe(false);
  });

  it("never includes api key in error messages", async () => {
    try {
      await providerWith(() => ({ body: "BAD_KEY" })).buyActivation({
        userId: 1,
        country: "NG",
        serviceId: "whatsapp",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      expect(msg).not.toContain("test-secret-key");
      expect(msg.toLowerCase()).not.toMatch(/sk_live|api_key=/);
    }
  });
});
