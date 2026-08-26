import { and, eq, sql } from "drizzle-orm";
import {
  auditLogs,
  smsActivations,
  temporaryInboxes,
  walletLedgerEntries,
  wallets,
  users,
  transactions,
  providers,
} from "../drizzle/schema";
import { getDb } from "./db";

export async function ensureWallet(
  userId: number,
  currency: "NGN" | "USD" = "NGN"
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const existing = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)))
    .limit(1);
  if (existing[0]) return existing[0];
  const created = await db
    .insert(wallets)
    .values({ userId, currency })
    .returning();
  return created[0];
}

export async function getUserWalletSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const wallet = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, "NGN")))
    .limit(1);
  if (!wallet[0]) return { currency: "NGN" as const, balance: 0, entries: 0 };
  const balance = await getWalletBalance(wallet[0].id);
  const entries = await db
    .select({ count: sql<number>`count(*)` })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, wallet[0].id));
  return {
    currency: "NGN" as const,
    balance,
    entries: Number(entries[0]?.count ?? 0),
  };
}

export async function listUserLedger(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const wallet = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, "NGN")))
    .limit(1);
  if (!wallet[0]) return [];
  return db
    .select()
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, wallet[0].id))
    .limit(Math.min(limit, 100))
    .offset(Math.max(offset, 0));
}

export async function getWalletBalance(walletId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const result = await db
    .select({
      balance: sql<number>`coalesce(sum(case when ${walletLedgerEntries.type} = 'CREDIT' then ${walletLedgerEntries.amountMinor} else -${walletLedgerEntries.amountMinor} end), 0)`,
    })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, walletId));
  return Number(result[0]?.balance ?? 0);
}

export async function appendLedgerEntry(input: {
  walletId: number;
  type: "CREDIT" | "DEBIT";
  amountMinor: number;
  reason: string;
  reference: string;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("amountMinor must be a positive integer");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db.transaction(async tx => {
    const duplicate = await tx
      .select()
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.reference, input.reference))
      .limit(1);
    if (duplicate[0]) return duplicate[0];
    if (input.type === "DEBIT") {
      const balance = await tx
        .select({
          balance: sql<number>`coalesce(sum(case when ${walletLedgerEntries.type} = 'CREDIT' then ${walletLedgerEntries.amountMinor} else -${walletLedgerEntries.amountMinor} end), 0)`,
        })
        .from(walletLedgerEntries)
        .where(eq(walletLedgerEntries.walletId, input.walletId));
      if (Number(balance[0]?.balance ?? 0) < input.amountMinor)
        throw new Error("Insufficient balance");
    }
    const inserted = await tx
      .insert(walletLedgerEntries)
      .values(input)
      .returning();
    return inserted[0];
  });
}

export async function persistActivation(input: {
  userId: number;
  providerType: string;
  countryCode: string;
  serviceId: string;
  phoneNumber?: string;
  status: string;
  quotedPriceMinor: number;
  currency: "NGN" | "USD";
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const inserted = await db.insert(smsActivations).values(input).returning();
  return inserted[0];
}

export async function persistInbox(input: {
  userId: number;
  address: string;
  domain: string;
  status: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const inserted = await db.insert(temporaryInboxes).values(input).returning();
  return inserted[0];
}

export async function getAdminMetrics() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const [
    userCount,
    activationCount,
    transactionVolume,
    auditCount,
    providerCount,
    inboxCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(smsActivations),
    db
      .select({
        volume: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
      })
      .from(transactions),
    db.select({ count: sql<number>`count(*)` }).from(auditLogs),
    db.select({ count: sql<number>`count(*)` }).from(providers),
    db.select({ count: sql<number>`count(*)` }).from(temporaryInboxes),
  ]);
  return {
    users: Number(userCount[0]?.count ?? 0),
    activations: Number(activationCount[0]?.count ?? 0),
    walletVolumeMinor: Number(transactionVolume[0]?.volume ?? 0),
    audits: Number(auditCount[0]?.count ?? 0),
    providers: Number(providerCount[0]?.count ?? 0),
    inboxes: Number(inboxCount[0]?.count ?? 0),
  };
}

export async function listAuditLogs(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db
    .select()
    .from(auditLogs)
    .limit(Math.min(limit, 100))
    .offset(Math.max(offset, 0));
}

export async function writeAuditLog(input: {
  actorUserId?: number;
  action: string;
  targetType: string;
  targetId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const inserted = await db
    .insert(auditLogs)
    .values({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      requestId: input.requestId,
      metadata: input.metadata ?? {},
    })
    .returning();
  return inserted[0];
}
