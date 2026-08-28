import { describe, expect, it } from "vitest";
import {
  appendLedgerEntry,
  calculateBalance,
  LocalDemoMailProvider,
  MockSMSProvider,
} from "./domain";

const credit = {
  id: "1",
  type: "CREDIT" as const,
  amount: 1000,
  currency: "NGN" as const,
  reason: "top up",
  reference: "ref-1",
  createdAt: new Date().toISOString(),
};

describe("wallet ledger", () => {
  it("calculates credits and debits without mutating the source ledger", () => {
    const entries = [credit];
    const result = appendLedgerEntry(entries, {
      id: "2",
      type: "DEBIT",
      amount: 250,
      currency: "NGN",
      reason: "request",
      reference: "ref-2",
      createdAt: new Date().toISOString(),
    });
    expect(entries).toHaveLength(1);
    expect(calculateBalance(result, "NGN")).toBe(750);
  });
  it("rejects an overdraft and non-positive entries", () => {
    expect(() =>
      appendLedgerEntry([credit], {
        id: "2",
        type: "DEBIT",
        amount: 1100,
        currency: "NGN",
        reason: "request",
        reference: "ref-2",
        createdAt: new Date().toISOString(),
      })
    ).toThrow("Insufficient balance");
    expect(() =>
      appendLedgerEntry([], {
        id: "2",
        type: "CREDIT",
        amount: 0,
        currency: "NGN",
        reason: "invalid",
        reference: "ref-2",
        createdAt: new Date().toISOString(),
      })
    ).toThrow("positive");
  });
});

describe("mock provider contracts", () => {
  it("creates a safe demo inbox", async () => {
    const inbox = await new LocalDemoMailProvider().createTemporaryInbox({
      userId: 7,
      label: "verify",
    });
    expect(inbox.address).toContain("@subby.demo");
    expect(inbox.status).toBe("ACTIVE");
  });
  it("returns supported SMS options and waiting activations", async () => {
    const provider = new MockSMSProvider();
    expect(
      (await provider.getCountries()).map(country => country.code)
    ).toContain("NG");
    expect(
      (
        await provider.buyActivation({
          userId: 7,
          country: "NG",
          serviceId: "verify",
        })
      ).status
    ).toBe("WAITING");
  });

  it("exposes a broad mock country catalog for SMS options", async () => {
    const provider = new MockSMSProvider();
    const countries = await provider.getCountries();
    const codes = countries.map(country => country.code);

    // Catalog must stay larger than the historical 3-country UI hardcode.
    expect(countries.length).toBeGreaterThanOrEqual(20);
    expect(new Set(codes).size).toBe(codes.length);
    for (const country of countries) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim().length).toBeGreaterThan(1);
    }
    expect(codes).toEqual(
      expect.arrayContaining([
        "NG",
        "US",
        "GB",
        "CA",
        "DE",
        "FR",
        "IN",
        "BR",
        "ZA",
        "KE",
        "GH",
      ])
    );
  });

  it("maps buyActivation phone numbers for catalog countries", async () => {
    const provider = new MockSMSProvider();
    const countries = await provider.getCountries();
    for (const country of countries.slice(0, 8)) {
      const activation = await provider.buyActivation({
        userId: 11,
        country: country.code,
        serviceId: "whatsapp",
      });
      expect(activation.phoneNumber.startsWith("+")).toBe(true);
      expect(activation.status).toBe("WAITING");
    }
  });
});
