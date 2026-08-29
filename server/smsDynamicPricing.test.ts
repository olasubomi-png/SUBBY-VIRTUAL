
import { afterEach, describe, expect, it } from "vitest";
import {
  applyMarkupBps,
  parseMarkupBps,
} from "./smsPricing";
import { retailKoboToPoints } from "./subbyPoints";
import {
  clearSmsCatalogCache,
  getCatalogSnapshot,
  resolvePriceQuote,
} from "./smsCatalog";
import { ExternalSmsProvider } from "./externalSmsProvider";
import { MockSMSProvider } from "./domain";
import { createSmsOrder, seedDemoCreditsForTests } from "./smsOrders";
import { listActivations, resetDemoState } from "./demoState";

afterEach(() => {
  clearSmsCatalogCache();
  resetDemoState();
});

describe("markup parsing", () => {
  it("accepts valid BPS values", () => {
    expect(parseMarkupBps(undefined)).toBe(4800);
    expect(parseMarkupBps("0")).toBe(0);
    expect(parseMarkupBps("100")).toBe(100);
    expect(parseMarkupBps("1000")).toBe(1000);
    expect(parseMarkupBps("1500")).toBe(1500);
  });

  it("rejects invalid BPS", () => {
    expect(() => parseMarkupBps("-1")).toThrow();
    expect(() => parseMarkupBps("1.5")).toThrow();
    expect(() => parseMarkupBps("abc")).toThrow();
    expect(() => parseMarkupBps("100001")).toThrow();
  });
});

describe("retail pricing arithmetic", () => {
  it("applies 0% and 10% markup with ceil", () => {
    expect(applyMarkupBps(10_000, 0)).toBe(10_000);
    expect(applyMarkupBps(10_000, 1000)).toBe(11_000);
    // 33300 * 1.10 = 36630 exact
    expect(applyMarkupBps(33_300, 1000)).toBe(36_630);
    // residual ceil: 100 * 1bps
    expect(applyMarkupBps(100, 1)).toBe(101);
  });
});

describe("dynamic external catalog prices", () => {
  it("changes retail when provider cost changes", async () => {
    const make = (cost: number) =>
      new ExternalSmsProvider(
        {
          mode: "external",
          maxProviderCostNgn: null,
          baseUrl: "https://sms.example.com/api",
          apiKey: "key",
        },
        {
          fetchImpl: async () =>
            ({
              ok: true,
              status: 200,
              text: async () =>
                JSON.stringify({
                  "19": { wa: { cost, count: 10 } },
                }),
            }) as Response,
        }
      );

    const env = {
      SMS_PROVIDER: "external",
      SMS_PROVIDER_BASE_URL: "https://sms.example.com/api",
      SMS_PROVIDER_API_KEY: "key",
      SMS_FX_MINOR_PER_PROVIDER_MAJOR: "160000",
      SMS_MARKUP_BPS: "0",
    };

    clearSmsCatalogCache();
    const a = await getCatalogSnapshot(make(0.675), env, { forceRefresh: true });
    const waA = a.entries.find(e => e.serviceId === "whatsapp" && e.countryCode === "NG");
    expect(waA).toBeDefined();

    clearSmsCatalogCache();
    const b = await getCatalogSnapshot(make(0.8), env, { forceRefresh: true });
    const waB = b.entries.find(e => e.serviceId === "whatsapp" && e.countryCode === "NG");
    expect(waB).toBeDefined();
    expect(waB!.retailPriceMinor).toBeGreaterThan(waA!.retailPriceMinor);
  });
});

describe("order pricing snapshot", () => {
  it("stores charge points and does not reprice after catalog change", async () => {
    seedDemoCreditsForTests(300, 10, "seed-300");
    const order = await createSmsOrder({
      userId: 300,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      provider: new MockSMSProvider(),
    });
    const storedPrice = order.priceMinor;
    expect(storedPrice).toBe(retailKoboToPoints(30_000));
    const listed = listActivations(300);
    expect(listed[0].priceMinor).toBe(storedPrice);
  });
});

describe("mock catalog retail", () => {
  it("returns whatsapp retail from mock provider cost", async () => {
    const quote = await resolvePriceQuote(
      new MockSMSProvider(),
      "NG",
      "whatsapp",
      { SMS_PROVIDER: "mock", SMS_MARKUP_BPS: "0" }
    );
    expect(quote.retailPriceMinor).toBe(30_000);
    expect(quote.pricingVersion).toMatch(/sms-live/);
  });

  it("applies markup on mock catalog", async () => {
    clearSmsCatalogCache();
    const quote = await resolvePriceQuote(
      new MockSMSProvider(),
      "NG",
      "whatsapp",
      { SMS_PROVIDER: "mock", SMS_MARKUP_BPS: "1000" }
    );
    expect(quote.retailPriceMinor).toBe(33_000); // 30000 * 1.10
  });
});
