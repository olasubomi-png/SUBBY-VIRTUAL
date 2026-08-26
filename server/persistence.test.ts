import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
vi.mock("./db", () => ({ getDb }));

function createFakeDb() {
  const inserted: unknown[] = [];
  const db = {
    transaction: async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        select: () => ({
          from: () => ({ where: () => ({ limit: async () => [] }) }),
        }),
        insert: () => ({
          values: (value: unknown) => ({
            returning: async () => {
              inserted.push(value);
              return [{ ...value, id: 1 }];
            },
          }),
        }),
      }),
  };
  return { db, inserted };
}

describe("PostgreSQL persistence helpers", () => {
  beforeEach(() => getDb.mockReset());

  it("writes a positive credit exactly once by idempotency reference", async () => {
    const fake = createFakeDb();
    getDb.mockResolvedValue(fake.db);
    const { appendLedgerEntry } = await import("./persistence");
    const entry = await appendLedgerEntry({
      walletId: 1,
      type: "CREDIT",
      amountMinor: 150,
      reason: "test",
      reference: "ref-1",
    });
    expect(entry).toMatchObject({
      walletId: 1,
      amountMinor: 150,
      reference: "ref-1",
    });
    expect(fake.inserted).toHaveLength(1);
  });

  it("rejects non-positive money before database access", async () => {
    const { appendLedgerEntry } = await import("./persistence");
    await expect(
      appendLedgerEntry({
        walletId: 1,
        type: "CREDIT",
        amountMinor: 0,
        reason: "test",
        reference: "ref-0",
      })
    ).rejects.toThrow("positive integer");
  });
});
