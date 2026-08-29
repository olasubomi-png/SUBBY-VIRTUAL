
import { describe, expect, it } from "vitest";
import {
  parseProviderPricesJson,
  toPublicCatalog,
  type NormalizedCatalogEntry,
} from "./smsCatalog";
import { resolveCountryName } from "./countryNames";

describe("catalog availability normalization", () => {
  it("marks inventory > 0 as available with count", () => {
    const entries: NormalizedCatalogEntry[] = [
      {
        countryCode: "NG",
        countryName: "Nigeria",
        serviceId: "whatsapp",
        serviceName: "WhatsApp",
        available: true,
        count: 9750,
        providerCostMinor: 10000,
        retailPriceMinor: 144000,
        currency: "NGN",
      },
    ];
    const pub = toPublicCatalog(entries);
    expect(pub[0].available).toBe(true);
    expect(pub[0].count).toBe(9750);
  });

  it("marks inventory = 0 as unavailable", () => {
    const entries: NormalizedCatalogEntry[] = [
      {
        countryCode: "UA",
        countryName: resolveCountryName("UA"),
        serviceId: "facebook",
        serviceName: "Facebook",
        available: false,
        count: 0,
        providerCostMinor: 5000,
        retailPriceMinor: 5500,
        currency: "NGN",
      },
    ];
    const pub = toPublicCatalog(entries);
    expect(pub[0].available).toBe(false);
    expect(pub[0].count).toBe(0);
  });

  it("parses provider counts into availability correctly", () => {
    const rows = parseProviderPricesJson(
      JSON.stringify({
        "19": { wa: { cost: 0.675, count: 198151 }, fb: { cost: 0.15, count: 0 } },
        "1": { wa: { cost: 0.5, count: 10 } },
      })
    );
    const ngWa = rows.find(r => r.countryId === 19 && r.serviceCode === "wa");
    const ngFb = rows.find(r => r.countryId === 19 && r.serviceCode === "fb");
    expect(ngWa?.count).toBe(198151);
    expect(ngFb?.count).toBe(0);
  });

  it("sorts available inventory before zero stock for marketplace defaults", () => {
    const list = [
      { available: false, count: 0, serviceId: "a" },
      { available: true, count: 100, serviceId: "b" },
      { available: true, count: 50, serviceId: "c" },
    ];
    const sorted = [...list].sort((a, b) => {
      const av =
        Number(b.available && b.count > 0) - Number(a.available && a.count > 0);
      if (av !== 0) return av;
      return (b.count || 0) - (a.count || 0);
    });
    expect(sorted[0].serviceId).toBe("b");
    expect(sorted[1].serviceId).toBe("c");
    expect(sorted[2].serviceId).toBe("a");
  });
});
