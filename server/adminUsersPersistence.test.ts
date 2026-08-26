import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  auditLogs,
  mailMessages,
  smsActivations,
  smsMessages,
  temporaryInboxes,
  transactions,
  users,
  walletLedgerEntries,
  wallets,
} from "../drizzle/schema";

const getDb = vi.fn();
vi.mock("./db", () => ({ getDb }));

type Query = {
  from: (table: unknown) => Query;
  where: (...args: unknown[]) => Query;
  orderBy: (...args: unknown[]) => Query;
  groupBy: (...args: unknown[]) => Query;
  innerJoin: (...args: unknown[]) => Query;
  limit: (value: number) => Query;
  offset: (value: number) => Query;
  then: (
    resolve: (value: unknown) => unknown,
    reject: (error: unknown) => unknown
  ) => Promise<unknown>;
};

function queryFor(results: unknown[]) {
  let table: unknown;
  const query = {} as Query;
  query.from = (value: unknown) => {
    table = value;
    return query;
  };
  query.where = () => query;
  query.orderBy = () => query;
  query.groupBy = () => query;
  query.innerJoin = () => query;
  query.limit = () => query;
  query.offset = () => query;
  query.then = (resolve, reject) =>
    Promise.resolve(results.shift() ?? []).then(resolve, reject);
  Object.defineProperty(query, "table", { get: () => table });
  return query;
}

function createSearchDb(count: number, pages: unknown[][]) {
  let call = 0;
  return {
    select: vi.fn(() => {
      const results =
        call++ % 2 === 0
          ? [[{ count }]]
          : [pages[Math.floor(call / 2) - 1] ?? []];
      return queryFor(results);
    }),
  };
}

function createDetailDb() {
  const createdAt = new Date("2026-08-26T12:00:00.000Z");
  const tableResults = new Map<unknown, unknown[]>([
    [
      users,
      [
        {
          id: 7,
          name: "Customer",
          email: "customer@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
          openId: "private-open-id",
        },
        {
          id: 8,
          name: "Other User",
          email: "other@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
          openId: "other-private-open-id",
        },
      ],
    ],
    [
      wallets,
      [
        { id: 4, userId: 7, currency: "NGN" },
        { id: 5, userId: 8, currency: "NGN" },
      ],
    ],
    [
      walletLedgerEntries,
      [
        {
          id: 1,
          walletId: 4,
          type: "CREDIT",
          amountMinor: 500,
          reason: "Demo credits",
          reference: "credit-7",
          createdAt,
          userId: 7,
        },
        {
          id: 2,
          walletId: 5,
          type: "CREDIT",
          amountMinor: 9000,
          reason: "Other user credit",
          reference: "credit-8",
          createdAt,
          userId: 8,
        },
      ],
    ],
    [
      transactions,
      [
        { count: 1, userId: 7 },
        { count: 9, userId: 8 },
      ],
    ],
    [
      smsActivations,
      [
        { status: "COMPLETED", count: 2, userId: 7 },
        { status: "FAILED", count: 9, userId: 8 },
      ],
    ],
    [
      temporaryInboxes,
      [
        { status: "ACTIVE", count: 1, userId: 7 },
        { status: "EXPIRED", count: 8, userId: 8 },
      ],
    ],
    [
      smsMessages,
      [
        { count: 2, userId: 7 },
        { count: 9, userId: 8 },
      ],
    ],
    [
      mailMessages,
      [
        { count: 3, userId: 7 },
        { count: 8, userId: 8 },
      ],
    ],
    [
      auditLogs,
      [
        {
          action: "sms.request.created",
          targetType: "smsActivation",
          targetId: "sms-1",
          metadata: {
            mode: "mock",
            openId: "private-open-id",
            body: "private message body",
            token: "secret-token",
          },
          createdAt,
          actorUserId: 7,
        },
        {
          action: "other.user.event",
          targetType: "user",
          targetId: "other-user",
          metadata: { mode: "mock", body: "other private body" },
          createdAt,
          actorUserId: 8,
        },
      ],
    ],
  ]);
  const db = {
    select: vi.fn(() => {
      const query = queryFor([]);
      let table: unknown;
      const originalFrom = query.from;
      query.from = value => {
        table = value;
        originalFrom(value);
        return query;
      };
      query.then = (resolve, reject) => {
        const rows = tableResults.get(table) ?? [];
        const filtered = rows.filter(row => {
          const record = row as {
            userId?: number;
            actorUserId?: number;
            walletId?: number;
          };
          if (record.userId !== undefined) return record.userId === 7;
          if (record.actorUserId !== undefined) return record.actorUserId === 7;
          if (record.walletId !== undefined) return record.walletId === 4;
          return true;
        });
        return Promise.resolve(filtered).then(resolve, reject);
      };
      return query;
    }),
  };
  return db;
}

describe("persistent admin user management", () => {
  beforeEach(() => getDb.mockReset());

  it("searches by identifier fields with bounded deterministic pagination", async () => {
    const createdAt = new Date("2026-08-26T12:00:00.000Z");
    const pages = [
      [
        {
          id: 7,
          name: "Customer One",
          email: "one@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
        },
        {
          id: 8,
          name: "Customer Two",
          email: "two@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
        },
      ],
      [
        {
          id: 9,
          name: "Customer Three",
          email: "three@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
        },
        {
          id: 10,
          name: "Customer Four",
          email: "four@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
        },
      ],
      [
        {
          id: 7,
          name: "Customer One",
          email: "one@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
        },
      ],
      [
        {
          id: 7,
          name: "Customer One",
          email: "one@example.com",
          role: "user",
          status: "active",
          createdAt,
          lastSignedIn: createdAt,
        },
      ],
    ];
    const db = createSearchDb(4, pages);
    getDb.mockResolvedValue(db);
    const { searchAdminUsers } = await import("./persistence");

    const byId = await searchAdminUsers("7", 0, 2);
    const secondPage = await searchAdminUsers("Customer", 1, 2);
    const byName = await searchAdminUsers("Customer", 0, 2);
    const byEmail = await searchAdminUsers("one@example.com", 0, 2);

    expect(db.select).toHaveBeenCalledTimes(8);
    expect(byId).toMatchObject({
      page: 0,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect(byId.items.map(item => item.id)).toEqual([7, 8]);
    expect(secondPage.items.map(item => item.id)).toEqual([9, 10]);
    expect(byName.items[0]).toMatchObject({ id: 7, name: "Customer One" });
    expect(byEmail.items[0]).toMatchObject({ email: "one@example.com" });
  });

  it("returns safe empty results when the persistent search has no matches", async () => {
    const db = createSearchDb(0, []);
    getDb.mockResolvedValue(db);
    const { searchAdminUsers } = await import("./persistence");
    await expect(
      searchAdminUsers("missing@example.com", 0, 10)
    ).resolves.toEqual({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it("returns only requested-user operational data and allowlisted audit metadata", async () => {
    const db = createDetailDb();
    getDb.mockResolvedValue(db);
    const { getAdminUserDetail, serializeSafeAuditMetadata } = await import(
      "./persistence"
    );
    const detail = await getAdminUserDetail(7);

    expect(detail.account).toMatchObject({
      id: 7,
      email: "customer@example.com",
      role: "user",
    });
    expect(detail.wallet).toMatchObject({
      balanceMinor: 500,
      creditsMinor: 500,
      spentMinor: 0,
      transactionCount: 1,
    });
    expect(detail.sms).toMatchObject({
      total: 2,
      completed: 2,
      messageCount: 2,
    });
    expect(detail.mail).toMatchObject({
      mailboxCount: 1,
      active: 1,
      messageCount: 3,
    });
    expect(detail.activity[0].metadata).toEqual({ mode: "mock" });
    expect(
      serializeSafeAuditMetadata({
        mode: "mock",
        body: "private",
        password: "secret",
        count: 2,
      })
    ).toEqual({ mode: "mock", count: 2 });
    expect(JSON.stringify(detail)).not.toContain("private-open-id");
    expect(JSON.stringify(detail)).not.toContain("private message body");
    expect(JSON.stringify(detail)).not.toContain("secret-token");
    expect(JSON.stringify(detail)).not.toContain("password");
    expect(JSON.stringify(detail)).not.toContain("other-user");
  });
});
