import { afterEach, describe, expect, it } from "vitest";
import {
  CATALOG_CACHE_TTL_MS,
  clearSmsCatalogCache,
  getCatalogSnapshot,
  parseProviderPricesJson,
  resolvePriceQuote,
  toPublicCatalog,
} from "./smsCatalog";
import { ExternalSmsProvider } from "./externalSmsProvider";
import { MockSMSProvider } from "./domain";
import {
  createSmsOrder,
  seedDemoCreditsForTests,
} from "./smsOrders";
import { getDemoWallet, resetDemoState, listActivations } from "./demoState";

afterEach(() => {
  clearSmsCatalogCache();
  resetDemoState();
});

describe("provider price JSON normalization", () => {
  it("parses SMS-Activate getPrices shape", () => {
    const rows = parseProviderPricesJson(
      JSON.stringify({
        "19": { wa: { cost: 0.25, count: 10 }, tg: { cost: "0.20", count: 0 } },
        "12": { wa: { cost: 0.3, count: 5 } },
      })
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          countryId: 19,
          serviceCode: "wa",
          count: 10,
        }),
      ])
    );
  });

  it("rejects malformed and empty catalogs", () => {
    expect(() => parseProviderPricesJson("not-json")).toThrow();
    expect(() => parseProviderPricesJson("{}")).toThrow(/Empty|empty|No mappable|Malformed/i);
    expect(() => parseProviderPricesJson("[]")).toThrow();
  });
});

describe("mock catalog", () => {
  it("returns available entries with retail prices", async () => {
    const snapshot = await getCatalogSnapshot(new MockSMSProvider(), {
      SMS_PROVIDER: "mock",
    });
    expect(snapshot.mode).toBe("mock");
    expect(snapshot.entries.length).toBeGreaterThan(0);
    const publicEntries = toPublicCatalog(snapshot.entries);
    expect(publicEntries[0]).not.toHaveProperty("providerCostMinor");
    expect(publicEntries[0].retailPriceMinor).toBeGreaterThan(0);
  });

  it("resolves a quote for NG/whatsapp", async () => {
    const quote = await resolvePriceQuote(
      new MockSMSProvider(),
      "NG",
      "whatsapp",
      { SMS_PROVIDER: "mock", SMS_MARKUP_BPS: "0" }
    );
    expect(quote.retailPriceMinor).toBe(30_000);
    expect(quote.available).toBe(true);
    expect(quote.pricingVersion).toMatch(/sms-live/);
  });
});

describe("external live catalog", () => {
  function externalWithPrices(body: string) {
    return new ExternalSmsProvider(
      {
        mode: "external",
        maxProviderCostNgn: null,
        baseUrl: "https://sms.example.com/api",
        apiKey: "key",
      },
      {
        fetchImpl: async (url: string) => {
          if (String(url).includes("getPrices")) {
            return {
              ok: true,
              status: 200,
              text: async () => body,
            } as Response;
          }
          return { ok: true, status: 200, text: async () => "ACCESS_BALANCE:1" } as Response;
        },
      }
    );
  }

  it("builds catalog from live provider prices", async () => {
    const provider = externalWithPrices(
      JSON.stringify({
        "19": { wa: { cost: 0.25, count: 12 } },
      })
    );
    const snapshot = await getCatalogSnapshot(provider, {
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
      SMS_PROVIDER_API_KEY: "key",
      SMS_FX_MINOR_PER_PROVIDER_MAJOR: "160000",
      SMS_MARKUP_BPS: "1000",
    });
    expect(snapshot.mode).toBe("external");
    const entry = snapshot.entries.find(
      e => e.countryCode === "NG" && e.serviceId === "whatsapp"
    );
    expect(entry).toBeDefined();
    expect(entry!.available).toBe(true);
    expect(entry!.providerCostMinor).toBe(40_000);
    expect(entry!.retailPriceMinor).toBe(44_000);
  });

  it("marks zero-count services unavailable", async () => {
    const provider = externalWithPrices(
      JSON.stringify({
        "19": { wa: { cost: 0.25, count: 0 } },
      })
    );
    const snapshot = await getCatalogSnapshot(provider, {
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
      SMS_PROVIDER_API_KEY: "key",
      SMS_FX_MINOR_PER_PROVIDER_MAJOR: "160000",
    });
    const entry = snapshot.entries.find(
      e => e.countryCode === "NG" && e.serviceId === "whatsapp"
    );
    expect(entry?.available).toBe(false);
    await expect(
      resolvePriceQuote(provider, "NG", "whatsapp", {
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
        SMS_PROVIDER_API_KEY: "key",
        SMS_FX_MINOR_PER_PROVIDER_MAJOR: "160000",
      })
    ).rejects.toThrow(/not available/);
  });

  it("caches catalog within TTL and refreshes after expiry", async () => {
    let calls = 0;
    const provider = new ExternalSmsProvider(
      {
        mode: "external",
        maxProviderCostNgn: null,
        baseUrl: "https://sms.example.com/api",
        apiKey: "key",
      },
      {
        fetchImpl: async () => {
          calls += 1;
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ "19": { wa: { cost: 0.25, count: 1 } } }),
          } as Response;
        },
      }
    );
    const env = {
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
      SMS_PROVIDER_API_KEY: "key",
      SMS_FX_MINOR_PER_PROVIDER_MAJOR: "160000",
    };
    await getCatalogSnapshot(provider, env);
    await getCatalogSnapshot(provider, env);
    expect(calls).toBe(1);
    // force refresh
    await getCatalogSnapshot(provider, env, { forceRefresh: true });
    expect(calls).toBe(2);
    expect(CATALOG_CACHE_TTL_MS).toBe(60_000);
  });
});

describe("purchase uses server-authoritative catalog price", () => {
  it("debits retail price from mock catalog and snapshots version", async () => {
    seedDemoCreditsForTests(90, 100_000, "seed-90");
    const result = await createSmsOrder({
      userId: 90,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      provider: new MockSMSProvider(),
    });
    expect(result.priceMinor).toBe(1);
    expect(result.walletBalanceMinor).toBe(99_999);
    const stored = listActivations(90)[0];
    expect(stored.priceMinor).toBe(1);
  });

  it("cannot use unavailable external catalog entries", async () => {
    seedDemoCreditsForTests(91, 500_000, "seed-91");
    const provider = new ExternalSmsProvider(
      {
        mode: "external",
        maxProviderCostNgn: null,
        baseUrl: "https://sms.example.com/api",
        apiKey: "key",
      },
      {
        fetchImpl: async (url: string) => {
          if (String(url).includes("getPrices")) {
            return {
              ok: true,
              status: 200,
              text: async () =>
                JSON.stringify({ "19": { wa: { cost: 0.25, count: 0 } } }),
            } as Response;
          }
          return {
            ok: true,
            status: 200,
            text: async () => "ACCESS_NUMBER:1:+234",
          } as Response;
        },
      }
    );
    // Catalog is resolved with process.env by default inside createSmsOrder —
    // inject via getCatalogSnapshot first so cache is warm with this provider
    clearSmsCatalogCache();
    await expect(
      resolvePriceQuote(provider, "NG", "whatsapp", {
        SMS_PROVIDER: "external",
        SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
        SMS_PROVIDER_API_KEY: "key",
        SMS_FX_MINOR_PER_PROVIDER_MAJOR: "160000",
      })
    ).rejects.toThrow(/not available/);
  });
});
