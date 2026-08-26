import {
  bigint,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "support"])
    .default("user")
    .notNull(),
  status: mysqlEnum("status", ["active", "suspended"])
    .default("active")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export const wallets = mysqlTable(
  "wallets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    currency: mysqlEnum("currency", ["NGN", "USD"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userCurrency: index("wallet_user_currency_idx").on(
      table.userId,
      table.currency
    ),
  })
);
export const walletLedgerEntries = mysqlTable(
  "walletLedgerEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    walletId: int("walletId").notNull(),
    type: mysqlEnum("type", ["CREDIT", "DEBIT"]).notNull(),
    amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    reference: varchar("reference", { length: 120 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    walletCreated: index("ledger_wallet_created_idx").on(
      table.walletId,
      table.createdAt
    ),
  })
);
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletId: int("walletId").notNull(),
  kind: mysqlEnum("kind", [
    "DEPOSIT",
    "PURCHASE",
    "REFUND",
    "ADJUSTMENT",
  ]).notNull(),
  status: mysqlEnum("status", [
    "PENDING",
    "COMPLETED",
    "FAILED",
    "REFUNDED",
  ]).notNull(),
  amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
  reference: varchar("reference", { length: 120 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const smsActivations = mysqlTable("smsActivations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  providerId: int("providerId"),
  countryCode: varchar("countryCode", { length: 3 }).notNull(),
  serviceId: varchar("serviceId", { length: 64 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  status: mysqlEnum("status", [
    "WAITING",
    "RECEIVED",
    "CANCELLED",
    "EXPIRED",
  ]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const smsMessages = mysqlTable("smsMessages", {
  id: int("id").autoincrement().primaryKey(),
  activationId: int("activationId").notNull(),
  body: text("body").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});
export const temporaryInboxes = mysqlTable("temporaryInboxes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  providerId: int("providerId"),
  address: varchar("address", { length: 320 }).notNull().unique(),
  status: mysqlEnum("status", ["ACTIVE", "EXPIRED", "DELETED"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const mailMessages = mysqlTable("mailMessages", {
  id: int("id").autoincrement().primaryKey(),
  inboxId: int("inboxId").notNull(),
  fromAddress: varchar("fromAddress", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});
export const providers = mysqlTable("providers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  type: mysqlEnum("type", ["SMS", "MAIL"]).notNull(),
  mode: mysqlEnum("mode", ["MOCK", "PRODUCTION"]).notNull(),
  status: mysqlEnum("status", ["ACTIVE", "PAUSED"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const providerBalances = mysqlTable("providerBalances", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull(),
  currency: mysqlEnum("currency", ["NGN", "USD"]).notNull(),
  amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});
export const priceRules = mysqlTable("priceRules", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId"),
  serviceId: varchar("serviceId", { length: 64 }).notNull(),
  currency: mysqlEnum("currency", ["NGN", "USD"]).notNull(),
  amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
  active: int("active").default(1).notNull(),
});
export const supportTickets = mysqlTable("supportTickets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subject: varchar("subject", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["OPEN", "PENDING", "RESOLVED"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId"),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("targetType", { length: 80 }).notNull(),
    targetId: varchar("targetId", { length: 80 }),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    actionCreated: index("audit_action_created_idx").on(
      table.action,
      table.createdAt
    ),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
