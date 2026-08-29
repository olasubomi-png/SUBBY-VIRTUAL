import { describe, expect, it } from "vitest";
import { resolveCountryName, countryFlagEmoji } from "./countryNames";
import { PROVIDER_SERVICE_LABELS } from "./smsProviderMapping";
import { toPublicCatalog, type NormalizedCatalogEntry } from "./smsCatalog";

describe("country name resolution", () => {
  it("resolves common ISO codes to readable names", () => {
    expect(resolveCountryName("NG")).toBe("Nigeria");
    expect(resolveCountryName("US")).toBe("United States");
    expect(resolveCountryName("GB")).toBe("United Kingdom");
    expect(resolveCountryName("PH")).toBe("Philippines");
    expect(resolveCountryName("UA")).toBe("Ukraine");
    expect(resolveCountryName("KZ")).toBe("Kazakhstan");
    expect(resolveCountryName("CN")).toBe("China");
    expect(resolveCountryName("MM")).toBe("Myanmar");
    expect(resolveCountryName("ID")).toBe("Indonesia");
    expect(resolveCountryName("MY")).toBe("Malaysia");
    expect(resolveCountryName("CA")).toBe("Canada");
    expect(resolveCountryName("DE")).toBe("Germany");
    expect(resolveCountryName("FR")).toBe("France");
    expect(resolveCountryName("IN")).toBe("India");
    expect(resolveCountryName("GH")).toBe("Ghana");
    expect(resolveCountryName("ZA")).toBe("South Africa");
  });

  it("is case-insensitive and falls back safely", () => {
    expect(resolveCountryName("ng")).toBe("Nigeria");
    expect(resolveCountryName("ZZ")).toBe("ZZ");
  });

  it("produces regional-indicator flags", () => {
    expect(countryFlagEmoji("NG")).toBe("🇳🇬");
    expect(countryFlagEmoji("US")).toBe("🇺🇸");
  });
});

describe("provider service labels", () => {
  it("maps provider codes to readable marketplace names", () => {
    expect(PROVIDER_SERVICE_LABELS.fb).toBe("Facebook");
    expect(PROVIDER_SERVICE_LABELS.wa).toBe("WhatsApp");
    expect(PROVIDER_SERVICE_LABELS.ig).toBe("Instagram");
    expect(PROVIDER_SERVICE_LABELS.tg).toBe("Telegram");
    expect(PROVIDER_SERVICE_LABELS.go).toBe("Google");
    expect(PROVIDER_SERVICE_LABELS.lf).toBe("TikTok");
    expect(PROVIDER_SERVICE_LABELS.tw).toBe("X / Twitter");
  });
});

describe("public catalog security", () => {
  it("does not expose providerCostMinor", () => {
    const entries: NormalizedCatalogEntry[] = [
      {
        countryCode: "NG",
        countryName: "Nigeria",
        serviceId: "facebook",
        serviceName: "Facebook",
        available: true,
        count: 50127,
        retailPriceMinor: 24000,
        providerCostMinor: 15000,
        currency: "NGN",
        providerCountryId: 19,
        providerServiceCode: "fb",
      },
    ];
    const pub = toPublicCatalog(entries);
    expect(pub[0].serviceName).toBe("Facebook");
    expect(pub[0].countryName).toBe("Nigeria");
    expect(pub[0].retailPriceMinor).toBe(24000);
    expect(pub[0].count).toBe(50127);
    expect(JSON.stringify(pub)).not.toContain("providerCost");
    expect(JSON.stringify(pub)).not.toContain("15000");
  });
});
