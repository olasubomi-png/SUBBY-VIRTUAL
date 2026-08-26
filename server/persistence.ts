import { and, eq, sql } from "drizzle-orm";
import {
  auditLogs,
  mailMessages,
  smsActivations,
  smsMessages,
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
  externalId?: string;
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
  externalId?: string;
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

export async function persistSmsMessage(input: {
  activationId: number;
  externalId: string;
  sender: string;
  recipient?: string;
  body: string;
  receivedAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const existing = await db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.activationId, input.activationId))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(smsMessages)
    .values({ ...input, source: "MOCK" })
    .returning();
  return inserted[0];
}

export async function persistMailMessage(input: {
  inboxId: number;
  externalId: string;
  fromAddress: string;
  toAddress?: string;
  subject: string;
  body: string;
  receivedAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const existing = await db
    .select()
    .from(mailMessages)
    .where(eq(mailMessages.inboxId, input.inboxId))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(mailMessages)
    .values({ ...input, source: "MOCK" })
    .returning();
  return inserted[0];
}

export async function getPersistentActivation(
  userId: number,
  externalId: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(smsActivations)
    .where(
      and(
        eq(smsActivations.userId, userId),
        eq(smsActivations.externalId, externalId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Activation not found");
  const messages = await db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.activationId, rows[0].id))
    .limit(1);
  return {
    id: rows[0].externalId ?? String(rows[0].id),
    userId: rows[0].userId,
    country: rows[0].countryCode,
    serviceId: rows[0].serviceId,
    phoneNumber: rows[0].phoneNumber ?? "",
    status: rows[0].status,
    priceMinor: rows[0].quotedPriceMinor,
    createdAt: rows[0].createdAt.toISOString(),
    expiresAt:
      rows[0].expiresAt?.toISOString() ?? rows[0].createdAt.toISOString(),
    message: messages[0]
      ? {
          sender: messages[0].sender,
          body: messages[0].body,
          receivedAt: messages[0].receivedAt.toISOString(),
        }
      : undefined,
  };
}

export async function getPersistentInbox(userId: number, externalId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(temporaryInboxes)
    .where(
      and(
        eq(temporaryInboxes.userId, userId),
        eq(temporaryInboxes.externalId, externalId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Inbox not found");
  const messages = await db
    .select()
    .from(mailMessages)
    .where(eq(mailMessages.inboxId, rows[0].id));
  return {
    id: rows[0].externalId ?? String(rows[0].id),
    userId: rows[0].userId,
    address: rows[0].address,
    status: rows[0].status,
    createdAt: rows[0].createdAt.toISOString(),
    expiresAt: rows[0].expiresAt.toISOString(),
    messages: messages.map(message => ({
      sender: message.fromAddress,
      subject: message.subject,
      body: message.body,
      receivedAt: message.receivedAt.toISOString(),
    })),
  };
}

export async function listPersistentActivations(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(smsActivations)
    .where(eq(smsActivations.userId, userId));
  return Promise.all(
    rows.map(async row => {
      const message = (
        await db
          .select()
          .from(smsMessages)
          .where(eq(smsMessages.activationId, row.id))
          .limit(1)
      )[0];
      return {
        id: row.externalId ?? String(row.id),
        userId: row.userId,
        country: row.countryCode,
        serviceId: row.serviceId,
        phoneNumber: row.phoneNumber ?? "",
        status: row.status,
        priceMinor: row.quotedPriceMinor,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? row.createdAt.toISOString(),
        message: message
          ? {
              sender: message.sender,
              body: message.body,
              receivedAt: message.receivedAt.toISOString(),
            }
          : undefined,
      };
    })
  );
}

export async function listPersistentInboxes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(temporaryInboxes)
    .where(eq(temporaryInboxes.userId, userId));
  return Promise.all(
    rows.map(async row => ({
      id: row.externalId ?? String(row.id),
      userId: row.userId,
      address: row.address,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      messages: (
        await db
          .select()
          .from(mailMessages)
          .where(eq(mailMessages.inboxId, row.id))
      ).map(message => ({
        sender: message.fromAddress,
        subject: message.subject,
        body: message.body,
        receivedAt: message.receivedAt.toISOString(),
      })),
    }))
  );
}

export async function completePersistentActivation(input: {
  userId: number;
  externalId: string;
  sender: string;
  recipient?: string;
  body: string;
  receivedAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(smsActivations)
      .where(
        and(
          eq(smsActivations.userId, input.userId),
          eq(smsActivations.externalId, input.externalId)
        )
      )
      .limit(1);
    const activation = rows[0];
    if (!activation) throw new Error("Activation not found");
    if (activation.status !== "WAITING" && activation.status !== "ACTIVE") {
      const message = await tx
        .select()
        .from(smsMessages)
        .where(eq(smsMessages.activationId, activation.id))
        .limit(1);
      if (message[0]) return { activation, message: message[0] };
      throw new Error("Invalid activation state");
    }
    const message = await tx
      .insert(smsMessages)
      .values({
        activationId: activation.id,
        externalId: `${input.externalId}:message`,
        sender: input.sender,
        recipient: input.recipient,
        body: input.body,
        receivedAt: input.receivedAt,
        source: "MOCK",
      })
      .returning();
    const updated = await tx
      .update(smsActivations)
      .set({
        status: "COMPLETED",
        completedAt: input.receivedAt,
        updatedAt: input.receivedAt,
      })
      .where(
        and(
          eq(smsActivations.id, activation.id),
          eq(smsActivations.userId, input.userId)
        )
      )
      .returning();
    return { activation: updated[0] ?? activation, message: message[0] };
  });
}

export async function persistCompletedInboxMessage(input: {
  userId: number;
  externalId: string;
  fromAddress: string;
  toAddress?: string;
  subject: string;
  body: string;
  receivedAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(temporaryInboxes)
      .where(
        and(
          eq(temporaryInboxes.userId, input.userId),
          eq(temporaryInboxes.externalId, input.externalId)
        )
      )
      .limit(1);
    const inbox = rows[0];
    if (!inbox) throw new Error("Inbox not found");
    if (inbox.status !== "ACTIVE" || inbox.expiresAt.getTime() <= Date.now())
      throw new Error("Inbox is expired");
    const existing = await tx
      .select()
      .from(mailMessages)
      .where(eq(mailMessages.inboxId, inbox.id))
      .limit(1);
    if (existing[0]) return { inbox, message: existing[0] };
    const message = await tx
      .insert(mailMessages)
      .values({
        inboxId: inbox.id,
        externalId: `${input.externalId}:message`,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        subject: input.subject,
        body: input.body,
        receivedAt: input.receivedAt,
        source: "MOCK",
      })
      .returning();
    return { inbox, message: message[0] };
  });
}

export async function cancelPersistentActivation(
  userId: number,
  externalId: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(smsActivations)
    .where(
      and(
        eq(smsActivations.userId, userId),
        eq(smsActivations.externalId, externalId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Activation not found");
  if (rows[0].status !== "WAITING" && rows[0].status !== "ACTIVE")
    throw new Error("Activation cannot be cancelled");
  const updated = await db
    .update(smsActivations)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(
      and(
        eq(smsActivations.userId, userId),
        eq(smsActivations.externalId, externalId)
      )
    )
    .returning();
  return updated[0];
}

export async function expirePersistentInbox(
  userId: number,
  externalId: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(temporaryInboxes)
    .where(
      and(
        eq(temporaryInboxes.userId, userId),
        eq(temporaryInboxes.externalId, externalId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Inbox not found");
  const updated = await db
    .update(temporaryInboxes)
    .set({ status: "EXPIRED", deletedAt: new Date() })
    .where(
      and(
        eq(temporaryInboxes.userId, userId),
        eq(temporaryInboxes.externalId, externalId)
      )
    )
    .returning();
  return updated[0];
}
