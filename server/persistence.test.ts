import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
vi.mock("./db", () => ({ getDb }));

function createFakeDb() {
  const inserted: unknown[] = [];
  const select = () => ({
    from: () => ({ where: () => ({ limit: async () => [] }) }),
  });
  const insert = () => ({
    values: (value: unknown) => ({
      onConflictDoNothing: () => ({
        returning: async () => {
          inserted.push(value);
          return [{ ...value, id: 1 }];
        },
      }),
      returning: async () => {
        inserted.push(value);
        return [{ ...value, id: 1 }];
      },
    }),
  });
  const db = {
    select,
    insert,
    transaction: async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        select,
        insert,
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

  it("persists SMS and email message metadata with stable external IDs", async () => {
    const fake = createFakeDb();
    getDb.mockResolvedValue(fake.db);
    const { persistSmsMessage, persistMailMessage } = await import(
      "./persistence"
    );
    await persistSmsMessage({
      activationId: 12,
      externalId: "sms-ext-12",
      userId: 7,
      recipient: "+2348000000000",
      body: "482913",
      source: "MOCK",
      receivedAt: new Date("2026-08-26T12:00:00.000Z"),
    });
    await persistMailMessage({
      inboxId: 13,
      externalId: "mail-ext-13",
      userId: 7,
      toAddress: "demo-13@subby.demo",
      subject: "Demo inbox message",
      body: "hello",
      source: "MOCK",
      receivedAt: new Date("2026-08-26T12:00:00.000Z"),
    });
    expect(fake.inserted).toHaveLength(2);
    expect(fake.inserted[0]).toMatchObject({
      activationId: 12,
      externalId: "sms-ext-12",
      recipient: "+2348000000000",
      source: "MOCK",
    });
    expect(fake.inserted[1]).toMatchObject({
      inboxId: 13,
      externalId: "mail-ext-13",
      toAddress: "demo-13@subby.demo",
      source: "MOCK",
    });
  });

  it("fails safely when PostgreSQL is not configured", async () => {
    getDb.mockResolvedValue(undefined);
    const { persistSmsMessage } = await import("./persistence");
    await expect(
      persistSmsMessage({
        activationId: 20,
        externalId: "sms-ext-20",
        userId: 7,
        recipient: "+2348000000020",
        body: "482913",
        source: "MOCK",
        receivedAt: new Date(),
      })
    ).rejects.toThrow("DATABASE_URL is not configured");
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
