import { and, asc, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
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
  jobs,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { JobStatus, JobType } from "./jobTypes";
import { safeJobMetadata } from "./jobTypes";

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
    .onConflictDoNothing()
    .returning();
  if (created[0]) return created[0];
  const retried = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)))
    .limit(1);
  if (!retried[0]) throw new Error("Wallet could not be initialized");
  return retried[0];
}

export async function getUserWalletSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const wallet = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, "NGN")))
    .limit(1);
  if (!wallet[0])
    return {
      currency: "NGN" as const,
      balance: 0,
      creditsMinor: 0,
      spentMinor: 0,
      entries: 0,
    };
  const ledger = await db
    .select()
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, wallet[0].id));
  const balance = ledger.reduce(
    (total, entry) =>
      total +
      (entry.type === "CREDIT" ? entry.amountMinor : -entry.amountMinor),
    0
  );
  const creditsMinor = ledger
    .filter(entry => entry.type === "CREDIT")
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const spentMinor = ledger
    .filter(entry => entry.type === "DEBIT")
    .reduce((total, entry) => total + entry.amountMinor, 0);
  return {
    currency: "NGN" as const,
    balance,
    creditsMinor,
    spentMinor,
    entries: ledger.length,
  };
}

export async function getPersistentWallet(userId: number) {
  const summary = await getUserWalletSummary(userId);
  const ledger = await listUserLedger(userId);
  return {
    balanceMinor: summary.balance,
    creditsMinor: summary.creditsMinor,
    spentMinor: summary.spentMinor,
    ledger: ledger.map(entry => ({
      id: String(entry.id),
      type: entry.type as "CREDIT" | "DEBIT",
      amountMinor: entry.amountMinor,
      description: entry.reason,
      referenceId: entry.reference,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export async function creditPersistentWallet(
  userId: number,
  amountMinor: number,
  reference: string
) {
  const wallet = await ensureWallet(userId, "NGN");
  await appendLedgerEntry({
    walletId: wallet.id,
    type: "CREDIT",
    amountMinor,
    reason: "Demo credits",
    reference,
  });
  return getPersistentWallet(userId);
}

export async function debitPersistentWallet(
  userId: number,
  amountMinor: number,
  reason: string,
  reference: string
) {
  const wallet = await ensureWallet(userId, "NGN");
  await appendLedgerEntry({
    walletId: wallet.id,
    type: "DEBIT",
    amountMinor,
    reason,
    reference,
  });
  return getPersistentWallet(userId);
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

export async function listPersistentWalletLedgers() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db.select().from(wallets);
  return Promise.all(
    rows.map(async wallet => ({
      walletId: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      entries: await db
        .select()
        .from(walletLedgerEntries)
        .where(eq(walletLedgerEntries.walletId, wallet.id)),
    }))
  );
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

const SAFE_ADMIN_AUDIT_KEYS = new Set([
  "mode",
  "country",
  "serviceId",
  "label",
  "providerType",
  "status",
  "reason",
  "amountMinor",
  "currency",
  "source",
  "operation",
  "count",
  "result",
]);

export function serializeSafeAuditMetadata(
  metadata: unknown
): Record<string, string | number | boolean> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return {};
  return Object.entries(metadata).reduce<
    Record<string, string | number | boolean>
  >((safe, [key, value]) => {
    if (
      SAFE_ADMIN_AUDIT_KEYS.has(key) &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
    )
      safe[key] = value;
    return safe;
  }, {});
}

export async function searchAdminUsers(query = "", page = 0, pageSize = 20) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const normalized = query.trim();
  const conditions = normalized
    ? [
        ilike(users.name, `%${normalized}%`),
        ilike(users.email, `%${normalized}%`),
        ...(Number.isSafeInteger(Number(normalized))
          ? [eq(users.id, Number(normalized))]
          : []),
      ]
    : [];
  const filter = conditions.length ? or(...conditions) : undefined;
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(filter);
  const total = Number(countRows[0]?.count ?? 0);
  const rows = await db
    .select()
    .from(users)
    .where(filter)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(pageSize)
    .offset(page * pageSize);
  return {
    items: rows.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      lastSignedIn: user.lastSignedIn.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getAdminUserDetail(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) throw new Error("User not found");
  const [
    wallet,
    transactionsCount,
    activationCounts,
    inboxCounts,
    smsMessageCount,
    mailMessageCount,
    auditRows,
    recentLedger,
  ] = await Promise.all([
    getUserWalletSummary(userId),
    db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
    db
      .select({ status: smsActivations.status, count: sql<number>`count(*)` })
      .from(smsActivations)
      .where(eq(smsActivations.userId, userId))
      .groupBy(smsActivations.status),
    db
      .select({ status: temporaryInboxes.status, count: sql<number>`count(*)` })
      .from(temporaryInboxes)
      .where(eq(temporaryInboxes.userId, userId))
      .groupBy(temporaryInboxes.status),
    db
      .select({ count: sql<number>`count(*)` })
      .from(smsMessages)
      .innerJoin(
        smsActivations,
        eq(smsMessages.activationId, smsActivations.id)
      )
      .where(eq(smsActivations.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mailMessages)
      .innerJoin(
        temporaryInboxes,
        eq(mailMessages.inboxId, temporaryInboxes.id)
      )
      .where(eq(temporaryInboxes.userId, userId)),
    db
      .select({
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.actorUserId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
    listUserLedger(userId, 10, 0),
  ]);
  const activationSummary = Object.fromEntries(
    activationCounts.map(item => [item.status, Number(item.count)])
  );
  const inboxSummary = Object.fromEntries(
    inboxCounts.map(item => [item.status, Number(item.count)])
  );
  const totalActivations = activationCounts.reduce(
    (total, item) => total + Number(item.count),
    0
  );
  const totalInboxes = inboxCounts.reduce(
    (total, item) => total + Number(item.count),
    0
  );
  return {
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      lastSignedIn: user.lastSignedIn.toISOString(),
    },
    wallet: {
      balanceMinor: wallet.balance,
      creditsMinor: wallet.creditsMinor,
      spentMinor: wallet.spentMinor,
      transactionCount: Number(transactionsCount[0]?.count ?? 0),
      recentTransactions: recentLedger.map(entry => ({
        type: entry.type,
        amountMinor: entry.amountMinor,
        reason: entry.reason,
        reference: entry.reference,
        createdAt: entry.createdAt.toISOString(),
      })),
    },
    sms: {
      total: totalActivations,
      completed: activationSummary.COMPLETED ?? 0,
      waiting: activationSummary.WAITING ?? 0,
      active: activationSummary.ACTIVE ?? 0,
      cancelled: activationSummary.CANCELLED ?? 0,
      expired: activationSummary.EXPIRED ?? 0,
      failed: activationSummary.FAILED ?? 0,
      messageCount: Number(smsMessageCount[0]?.count ?? 0),
    },
    mail: {
      mailboxCount: totalInboxes,
      active: inboxSummary.ACTIVE ?? 0,
      expired: inboxSummary.EXPIRED ?? 0,
      messageCount: Number(mailMessageCount[0]?.count ?? 0),
    },
    activity: auditRows.map(item => ({
      action: item.action,
      targetType: item.targetType,
      targetId: item.targetId,
      metadata: serializeSafeAuditMetadata(item.metadata),
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function listPersistentAdminActivations() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db.select().from(smsActivations);
  return Promise.all(
    rows.map(async row => {
      const messages = await db
        .select()
        .from(smsMessages)
        .where(eq(smsMessages.activationId, row.id))
        .limit(1);
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
        hasMessage: Boolean(messages[0]),
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

export async function listPersistentAdminInboxes() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db.select().from(temporaryInboxes);
  return Promise.all(
    rows.map(async row => ({
      id: row.externalId ?? String(row.id),
      userId: row.userId,
      address: row.address,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      messageCount: (
        await db
          .select()
          .from(mailMessages)
          .where(eq(mailMessages.inboxId, row.id))
      ).length,
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
    const { normalizeSmsOrderStatus, isCodeEligibleSmsOrderStatus } =
      await import("./smsOrderLifecycle");
    let currentStatus;
    try {
      currentStatus = normalizeSmsOrderStatus(activation.status);
    } catch {
      throw new Error("Invalid activation state");
    }
    if (!isCodeEligibleSmsOrderStatus(currentStatus)) {
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
        status: "completed",
        completedAt: input.receivedAt,
        updatedAt: input.receivedAt,
        verificationCode:
          input.body.match(/\d{4,8}/)?.[0] ?? activation.verificationCode,
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
  const {
    assertSmsOrderTransitionFromRaw,
    isCancellableSmsOrderStatus,
    normalizeSmsOrderStatus,
  } = await import("./smsOrderLifecycle");
  const from = normalizeSmsOrderStatus(rows[0].status);
  if (!isCancellableSmsOrderStatus(from))
    throw new Error("Activation cannot be cancelled");
  assertSmsOrderTransitionFromRaw(rows[0].status, "cancelled");
  const now = new Date();
  const updated = await db
    .update(smsActivations)
    .set({ status: "cancelled", updatedAt: now, cancelledAt: now })
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

function safePersistentJob(row: any) {
  const safePayload = safeJobMetadata(row.payload);
  const safeResult = safeJobMetadata(row.result);
  return {
    id: row.externalId,
    userId: row.userId,
    jobType: row.jobType as JobType,
    status: row.status as JobStatus,
    payload: safePayload,
    result: Object.keys(safeResult).length ? safeResult : undefined,
    error:
      row.error && typeof row.error === "object"
        ? {
            code:
              typeof row.error.code === "string" ? row.error.code : "JOB_ERROR",
            message:
              typeof row.error.message === "string"
                ? row.error.message.slice(0, 200)
                : "Job failed",
          }
        : undefined,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    progress: row.progress,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    nextRunAt: row.nextRunAt.toISOString(),
    recoveryCount: row.recoveryCount ?? 0,
    lastRecoveredAt: row.lastRecoveredAt?.toISOString(),
  };
}

export async function createPersistentJob(input: {
  externalId: string;
  userId: number;
  jobType: JobType;
  payload: Record<string, string>;
  maxAttempts: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const created = await db.transaction(async tx => {
    const rows = await tx
      .insert(jobs)
      .values({
        externalId: input.externalId,
        userId: input.userId,
        jobType: input.jobType,
        payload: input.payload,
        maxAttempts: input.maxAttempts,
      })
      .onConflictDoNothing({ target: jobs.externalId })
      .returning();
    if (rows[0]) return { row: rows[0], inserted: true };
    const existing = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.externalId, input.externalId))
      .limit(1);
    if (!existing[0]) throw new Error("Job could not be created or recovered");
    return { row: existing[0], inserted: false };
  });
  if (!created.inserted) return safePersistentJob(created.row);
  await writeAuditLog({
    actorUserId: input.userId,
    action: "job.created",
    targetType: "job",
    targetId: input.externalId,
    metadata: { jobType: input.jobType, status: "QUEUED" },
  });
  await writeAuditLog({
    actorUserId: input.userId,
    action: "job.queued",
    targetType: "job",
    targetId: input.externalId,
    metadata: { jobType: input.jobType, status: "QUEUED" },
  });
  return safePersistentJob(created.row);
}
export async function listPersistentJobs(
  userId: number,
  page = 0,
  pageSize = 20
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.userId, userId)),
    db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .limit(Math.min(pageSize, 50))
      .offset(Math.max(page, 0) * Math.min(pageSize, 50)),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  return {
    items: rows.map(safePersistentJob),
    page,
    pageSize: Math.min(pageSize, 50),
    total,
    totalPages: Math.ceil(total / Math.min(pageSize, 50)),
  };
}

export async function getPersistentJob(userId: number, externalId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.externalId, externalId)))
    .limit(1);
  if (!rows[0]) throw new Error("Job not found");
  return safePersistentJob(rows[0]);
}

export async function listPersistentJobActivity(
  userId: number,
  externalId: string,
  limit = 50
) {
  await getPersistentJob(userId, externalId);
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select({
      id: auditLogs.id,
      eventType: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorUserId, userId),
        eq(auditLogs.targetType, "job"),
        eq(auditLogs.targetId, externalId)
      )
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(Math.min(limit, 100));
  return rows.map(row => ({
    id: String(row.id),
    eventType: row.eventType,
    metadata: safeJobMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function cancelPersistentJob(userId: number, externalId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.externalId, externalId)))
    .limit(1);
  const job = rows[0];
  if (!job) throw new Error("Job not found");
  if (job.status !== "QUEUED" && job.status !== "RETRYING")
    throw new Error("Job cannot be cancelled in its current state");
  const now = new Date();
  const updated = await db
    .update(jobs)
    .set({ status: "CANCELLED", cancelledAt: now, updatedAt: now })
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.externalId, externalId),
        or(eq(jobs.status, "QUEUED"), eq(jobs.status, "RETRYING"))
      )
    )
    .returning();
  if (!updated[0])
    throw new Error("Job cannot be cancelled in its current state");
  await writeAuditLog({
    actorUserId: userId,
    action: "job.cancelled",
    targetType: "job",
    targetId: externalId,
    metadata: { status: "CANCELLED" },
  });
  return safePersistentJob(updated[0]);
}

export async function claimNextPersistentJob(
  workerId: string,
  now = new Date()
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const result = await db.execute(sql`
    WITH candidate AS (
      SELECT "id"
      FROM "jobs"
      WHERE "status" IN ('QUEUED', 'RETRYING')
        AND "nextRunAt" <= ${now}
        AND "attemptCount" < "maxAttempts"
      ORDER BY "createdAt", "id"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "jobs" AS job
    SET "status" = 'PROCESSING',
        "attemptCount" = job."attemptCount" + 1,
        "startedAt" = COALESCE(job."startedAt", ${now}),
        "lockedAt" = ${now},
        "lockedBy" = ${workerId},
        "updatedAt" = ${now}
    FROM candidate
    WHERE job."id" = candidate."id"
    RETURNING job.*
  `);
  const row = (result as { rows?: any[] }).rows?.[0];
  if (!row) return undefined;
  await writeAuditLog({
    actorUserId: row.userId,
    action: "job.processing_started",
    targetType: "job",
    targetId: row.externalId,
    metadata: {
      jobType: row.jobType,
      status: "PROCESSING",
      attempt: row.attemptCount,
    },
  });
  return row;
}

export async function updatePersistentJobProgress(
  jobId: number,
  workerId: string,
  progress: number,
  userId: number,
  externalId: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const now = new Date();
  const updated = await db
    .update(jobs)
    .set({ progress: Math.max(0, Math.min(99, progress)), updatedAt: now })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.lockedBy, workerId),
        eq(jobs.status, "PROCESSING")
      )
    )
    .returning();
  if (!updated[0]) throw new Error("Job claim is no longer active");
  await writeAuditLog({
    actorUserId: userId,
    action: "job.progress_changed",
    targetType: "job",
    targetId: externalId,
    metadata: { progress: updated[0].progress },
  });
  return updated[0];
}

export async function completePersistentJob(
  jobId: number,
  workerId: string,
  userId: number,
  externalId: string,
  result: Record<string, string | number | boolean>
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const now = new Date();
  const updated = await db
    .update(jobs)
    .set({
      status: "COMPLETED",
      progress: 100,
      result: safeJobMetadata(result),
      completedAt: now,
      lockedBy: null,
      lockedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.lockedBy, workerId),
        eq(jobs.status, "PROCESSING")
      )
    )
    .returning();
  if (!updated[0]) throw new Error("Job claim is no longer active");
  await writeAuditLog({
    actorUserId: userId,
    action: "job.completed",
    targetType: "job",
    targetId: externalId,
    metadata: { status: "COMPLETED" },
  });
  return safePersistentJob(updated[0]);
}

export async function settlePersistentJobFailure(input: {
  jobId: number;
  workerId: string;
  userId: number;
  externalId: string;
  error: { code: string; message: string };
  retryAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const retry = Boolean(input.retryAt);
  const now = new Date();
  const updated = await db
    .update(jobs)
    .set({
      status: retry ? "RETRYING" : "FAILED",
      error: input.error,
      nextRunAt: input.retryAt ?? now,
      lockedBy: null,
      lockedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobs.id, input.jobId),
        eq(jobs.lockedBy, input.workerId),
        eq(jobs.status, "PROCESSING")
      )
    )
    .returning();
  if (!updated[0]) throw new Error("Job claim is no longer active");
  await writeAuditLog({
    actorUserId: input.userId,
    action: retry ? "job.retry_scheduled" : "job.failed",
    targetType: "job",
    targetId: input.externalId,
    metadata: {
      status: retry ? "RETRYING" : "FAILED",
      code: input.error.code,
      attempt: updated[0].attemptCount,
    },
  });
  return safePersistentJob(updated[0]);
}

export async function recoverStalePersistentJobs(
  now = new Date(),
  timeoutMs = 5 * 60_000
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const cutoff = new Date(now.getTime() - timeoutMs);
  const candidates = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "PROCESSING"), lt(jobs.updatedAt, cutoff)))
    .limit(1000);
  const recovered = [];
  for (const candidate of candidates) {
    const exhausted = candidate.attemptCount >= candidate.maxAttempts;
    const nextRunAt = exhausted
      ? now
      : new Date(
          now.getTime() + Math.min(30_000, 1_000 * 2 ** candidate.attemptCount)
        );
    const updated = await db
      .update(jobs)
      .set({
        status: exhausted ? "FAILED" : "RETRYING",
        error: {
          code: exhausted ? "STALE_JOB_EXHAUSTED" : "STALE_JOB_RECOVERED",
          message: exhausted
            ? "Job exceeded its processing timeout after the retry budget was exhausted."
            : "Job was returned to the queue after its worker stopped reporting progress.",
        },
        nextRunAt,
        lockedBy: null,
        lockedAt: null,
        recoveryCount: sql`${jobs.recoveryCount} + 1`,
        lastRecoveredAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(jobs.id, candidate.id),
          eq(jobs.status, "PROCESSING"),
          lt(jobs.updatedAt, cutoff)
        )
      )
      .returning();
    if (!updated[0]) continue;
    await writeAuditLog({
      actorUserId: updated[0].userId,
      action: exhausted ? "job.stale_failed" : "job.stale_recovered",
      targetType: "job",
      targetId: updated[0].externalId,
      metadata: {
        status: updated[0].status,
        recoveryCount: updated[0].recoveryCount,
        attempt: updated[0].attemptCount,
      },
    });
    recovered.push(safePersistentJob(updated[0]));
  }
  return recovered;
}

export async function getPersistentJobMetrics() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select({ status: jobs.status, count: sql<number>`count(*)` })
    .from(jobs)
    .groupBy(jobs.status);
  const metrics = {
    total: 0,
    queued: 0,
    processing: 0,
    retrying: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    const key = row.status.toLowerCase() as keyof typeof metrics;
    if (key in metrics) metrics[key] = Number(row.count);
    metrics.total += Number(row.count);
  }
  return metrics;
}

export async function listPersistentAdminJobs(
  page = 0,
  pageSize = 20,
  status?: JobStatus
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const condition = status ? eq(jobs.status, status) : undefined;
  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(condition),
    db
      .select()
      .from(jobs)
      .where(condition)
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .limit(Math.min(pageSize, 50))
      .offset(Math.max(page, 0) * Math.min(pageSize, 50)),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  return {
    items: rows.map(safePersistentJob),
    page,
    pageSize: Math.min(pageSize, 50),
    total,
    totalPages: Math.ceil(total / Math.min(pageSize, 50)),
  };
}

export async function listPersistentAdminJobActivity(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.actorUserId,
      jobId: auditLogs.targetId,
      eventType: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.targetType, "job"))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(Math.min(limit, 100));
  return rows.map(row => ({
    id: String(row.id),
    userId: row.userId,
    jobId: row.jobId,
    eventType: row.eventType,
    metadata: safeJobMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function expirePersistentActivation(
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
  const {
    assertSmsOrderTransitionFromRaw,
    isExpirableSmsOrderStatus,
    normalizeSmsOrderStatus,
  } = await import("./smsOrderLifecycle");
  const from = normalizeSmsOrderStatus(rows[0].status);
  if (from === "expired") return rows[0];
  if (!isExpirableSmsOrderStatus(from))
    throw new Error("Activation cannot be expired in its current state");
  assertSmsOrderTransitionFromRaw(rows[0].status, "expired");
  const now = new Date();
  const updated = await db
    .update(smsActivations)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(smsActivations.userId, userId),
        eq(smsActivations.externalId, externalId)
      )
    )
    .returning();
  if (!updated[0])
    throw new Error("Activation cannot be expired in its current state");
  return updated[0];
}

export async function getPersistentAdminJob(externalId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.externalId, externalId))
    .limit(1);
  if (!rows[0]) throw new Error("Job not found");
  return safePersistentJob(rows[0]);
}


export type CreateSmsOrderAtomicInput = {
  userId: number;
  externalId: string;
  idempotencyKey: string;
  providerType: string;
  countryCode: string;
  serviceId: string;
  quotedPriceMinor: number;
  currency: "NGN" | "USD";
  status: string;
  expiresAt: Date;
  debitReason: string;
  debitReference: string;
};

/**
 * Atomically create an SMS order and debit the wallet once.
 * Idempotent on (userId, idempotencyKey) and ledger reference.
 */
export async function createSmsOrderAtomic(input: CreateSmsOrderAtomicInput) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db.transaction(async tx => {
    const existing = await tx
      .select()
      .from(smsActivations)
      .where(
        and(
          eq(smsActivations.userId, input.userId),
          eq(smsActivations.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1);
    if (existing[0]) {
      const balance = await getWalletBalanceTx(tx, input.userId);
      return {
        order: {
          id: existing[0].externalId ?? String(existing[0].id),
          status: existing[0].status,
        },
        balanceMinor: balance,
        reused: true as const,
      };
    }

    const walletRows = await tx
      .select()
      .from(wallets)
      .where(
        and(eq(wallets.userId, input.userId), eq(wallets.currency, input.currency))
      )
      .limit(1);
    let wallet = walletRows[0];
    if (!wallet) {
      const insertedWallet = await tx
        .insert(wallets)
        .values({ userId: input.userId, currency: input.currency })
        .returning();
      wallet = insertedWallet[0];
    }

    const balanceResult = await tx
      .select({
        balance: sql<number>`coalesce(sum(case when ${walletLedgerEntries.type} = 'CREDIT' then ${walletLedgerEntries.amountMinor} else -${walletLedgerEntries.amountMinor} end), 0)`,
      })
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.walletId, wallet.id));
    const balance = Number(balanceResult[0]?.balance ?? 0);
    if (balance < input.quotedPriceMinor) throw new Error("Insufficient balance");

    const ledgerDup = await tx
      .select()
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.reference, input.debitReference))
      .limit(1);

    const now = new Date();
    const inserted = await tx
      .insert(smsActivations)
      .values({
        userId: input.userId,
        externalId: input.externalId,
        providerType: input.providerType,
        countryCode: input.countryCode,
        serviceId: input.serviceId,
        status: input.status,
        quotedPriceMinor: input.quotedPriceMinor,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        expiresAt: input.expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!ledgerDup[0]) {
      await tx.insert(walletLedgerEntries).values({
        walletId: wallet.id,
        type: "DEBIT",
        amountMinor: input.quotedPriceMinor,
        reason: input.debitReason,
        reference: input.debitReference,
      });
    }

    const newBalance = balance - (ledgerDup[0] ? 0 : input.quotedPriceMinor);
    return {
      order: {
        id: inserted[0].externalId ?? String(inserted[0].id),
        status: inserted[0].status,
      },
      balanceMinor: newBalance,
      reused: false as const,
    };
  });
}

async function getWalletBalanceTx(tx: any, userId: number) {
  const walletRows = await tx
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, "NGN")))
    .limit(1);
  if (!walletRows[0]) return 0;
  const balanceResult = await tx
    .select({
      balance: sql<number>`coalesce(sum(case when ${walletLedgerEntries.type} = 'CREDIT' then ${walletLedgerEntries.amountMinor} else -${walletLedgerEntries.amountMinor} end), 0)`,
    })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, walletRows[0].id));
  return Number(balanceResult[0]?.balance ?? 0);
}

export async function findSmsOrderByIdempotencyKey(
  userId: number,
  idempotencyKey: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const rows = await db
    .select()
    .from(smsActivations)
    .where(
      and(
        eq(smsActivations.userId, userId),
        eq(smsActivations.idempotencyKey, idempotencyKey)
      )
    )
    .limit(1);
  if (!rows[0]) return null;
  return {
    id: rows[0].externalId ?? String(rows[0].id),
    status: rows[0].status,
    userId: rows[0].userId,
  };
}

export async function transitionPersistentSmsOrder(input: {
  userId: number;
  externalId: string;
  to: string;
  phoneNumber?: string;
  providerReference?: string;
  verificationCode?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const { assertSmsOrderTransition, normalizeSmsOrderStatus } = await import(
    "./smsOrderLifecycle"
  );
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
    if (!rows[0]) throw new Error("Activation not found");
    const from = normalizeSmsOrderStatus(rows[0].status);
    const to = normalizeSmsOrderStatus(input.to);
    assertSmsOrderTransition(from, to);
    const now = new Date();
    const patch: Record<string, unknown> = {
      status: to,
      updatedAt: now,
    };
    if (input.phoneNumber !== undefined) patch.phoneNumber = input.phoneNumber;
    if (input.providerReference !== undefined)
      patch.providerReference = input.providerReference;
    if (input.verificationCode !== undefined)
      patch.verificationCode = input.verificationCode;
    if (to === "cancelled") patch.cancelledAt = now;
    if (to === "completed") patch.completedAt = now;
    const updated = await tx
      .update(smsActivations)
      .set(patch)
      .where(eq(smsActivations.id, rows[0].id))
      .returning();
    return updated[0];
  });
}
