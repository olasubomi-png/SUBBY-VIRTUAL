
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SMS_MARKUP_BPS,
  applyMarkupBps,
  parseMarkupBps,
  markupAmountMinor,
  grossProfitMinor,
} from "./smsPricing";

describe("48% marketplace markup", () => {
  it("defaults to 4800 BPS when unset", () => {
    expect(DEFAULT_SMS_MARKUP_BPS).toBe(4800);
    expect(parseMarkupBps(undefined)).toBe(4800);
    expect(parseMarkupBps("")).toBe(4800);
    expect(parseMarkupBps("   ")).toBe(4800);
  });

  it("applies 48% to whole NGN kobo amounts", () => {
    // ₦100 = 10_000 kobo → ₦148 = 14_800 kobo
    expect(applyMarkupBps(10_000, 4800)).toBe(14_800);
    // ₦200 → ₦296
    expect(applyMarkupBps(20_000, 4800)).toBe(29_600);
    // ₦500 → ₦740
    expect(applyMarkupBps(50_000, 4800)).toBe(74_000);
  });

  it("ceils residual fractions so we never undercharge", () => {
    // 333 * 1.48 = 492.84 → ceil 493
    expect(applyMarkupBps(333, 4800)).toBe(493);
  });

  it("computes markup amount and gross profit", () => {
    const cost = 10_000;
    const retail = applyMarkupBps(cost, 4800);
    expect(markupAmountMinor(cost, retail)).toBe(4_800);
    expect(grossProfitMinor(cost, retail)).toBe(4_800);
  });

  it("honors explicit override including zero", () => {
    expect(parseMarkupBps("0")).toBe(0);
    expect(parseMarkupBps("1000")).toBe(1000);
    expect(() => parseMarkupBps("-1")).toThrow();
  });
});
