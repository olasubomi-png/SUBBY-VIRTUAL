import { describe, expect, it } from "vitest";
import {
  applyMarkupBps,
  computeRetailFromProviderMajor,
  parseFxMinorPerProviderMajor,
  parseMarkupBps,
  providerCentsToWalletMinor,
  providerMajorToCents,
  DEFAULT_SMS_MARKUP_BPS,
} from "./smsPricing";

describe("SMS pricing integer math", () => {
  it("parses provider major amounts to cents deterministically", () => {
    expect(providerMajorToCents("1.25")).toBe(125);
    expect(providerMajorToCents(1.25)).toBe(125);
    expect(providerMajorToCents("0.01")).toBe(1);
    expect(providerMajorToCents("1.001")).toBe(101); // ceil residual
  });

  it("rejects invalid prices", () => {
    expect(() => providerMajorToCents(0)).toThrow(/positive|Invalid/);
    expect(() => providerMajorToCents(-1)).toThrow();
    expect(() => providerMajorToCents(NaN)).toThrow();
    expect(() => providerMajorToCents("abc")).toThrow();
    expect(() => providerMajorToCents(Infinity)).toThrow();
  });

  it("converts provider cents to wallet minor with ceil", () => {
    // 25 cents * 160000 / 100 = 40000
    expect(providerCentsToWalletMinor(25, 160_000)).toBe(40_000);
    // 1 cent * 160000 / 100 = 1600
    expect(providerCentsToWalletMinor(1, 160_000)).toBe(1_600);
  });

  it("applies markup in basis points with ceil", () => {
    expect(applyMarkupBps(10_000, 0)).toBe(10_000);
    expect(applyMarkupBps(10_000, 1000)).toBe(11_000); // +10%
    expect(applyMarkupBps(100, 1)).toBe(101); // ceil
  });

  it("defaults marketplace markup to 48%", () => {
    expect(DEFAULT_SMS_MARKUP_BPS).toBe(4800);
    expect(parseMarkupBps(undefined)).toBe(4800);
    expect(applyMarkupBps(10_000, DEFAULT_SMS_MARKUP_BPS)).toBe(14_800);
  });

  it("computes full retail path", () => {
    const { providerCostMinor, retailPriceMinor } =
      computeRetailFromProviderMajor("0.25", 160_000, 1000);
    expect(providerCostMinor).toBe(40_000);
    expect(retailPriceMinor).toBe(44_000);
  });

  it("parses markup and fx config", () => {
    expect(parseMarkupBps(undefined)).toBe(4800);
    expect(parseMarkupBps("500")).toBe(500);
    expect(() => parseMarkupBps("-1")).toThrow();
    expect(parseFxMinorPerProviderMajor("160000")).toBe(160_000);
    expect(() => parseFxMinorPerProviderMajor("0")).toThrow();
  });
});
