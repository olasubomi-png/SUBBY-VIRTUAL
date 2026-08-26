import {
  bigint,
  index,
  integer,
  uniqueIndex,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: varchar("role", { length: 16 }).default("user").notNull(),
    status: varchar("status", { length: 16 }).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({
    emailSearch: index("users_email_search_idx").on(table.email),
    nameSearch: index("users_name_search_idx").on(table.name),
    createdOrder: index("users_created_order_idx").on(
      table.createdAt,
      table.id
    ),
  })
);
export const wallets = pgTable(
  "wallets",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userCurrency: uniqueIndex("wallet_user_currency_unique").on(
      table.userId,
      table.currency
    ),
  })
);
export const walletLedgerEntries = pgTable(
  "walletLedgerEntries",
  {
    id: serial("id").primaryKey(),
    walletId: integer("walletId").notNull(),
    type: varchar("type", { length: 8 }).notNull(),
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
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  walletId: integer("walletId").notNull(),
  kind: varchar("kind", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
  reference: varchar("reference", { length: 120 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const smsActivations = pgTable("smsActivations", {
  id: serial("id").primaryKey(),
  externalId: varchar("externalId", { length: 120 }).unique(),
  userId: integer("userId").notNull(),
  providerId: integer("providerId"),
  providerType: varchar("providerType", { length: 16 })
    .notNull()
    .default("MOCK"),
  countryCode: varchar("countryCode", { length: 3 }).notNull(),
  serviceId: varchar("serviceId", { length: 64 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  status: varchar("status", { length: 16 }).notNull(),
  quotedPriceMinor: bigint("quotedPriceMinor", { mode: "number" })
    .notNull()
    .default(0),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  completedAt: timestamp("completedAt"),
});
export const smsMessages = pgTable("smsMessages", {
  id: serial("id").primaryKey(),
  externalId: varchar("externalId", { length: 120 }).unique(),
  activationId: integer("activationId").notNull().unique(),
  sender: varchar("sender", { length: 320 }).notNull().default("demo.sender"),
  recipient: varchar("recipient", { length: 320 }),
  source: varchar("source", { length: 32 }).notNull().default("MOCK"),
  body: text("body").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});
export const temporaryInboxes = pgTable("temporaryInboxes", {
  id: serial("id").primaryKey(),
  externalId: varchar("externalId", { length: 120 }).unique(),
  userId: integer("userId").notNull(),
  providerId: integer("providerId"),
  address: varchar("address", { length: 320 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull().default("subby.demo"),
  expiresAt: timestamp("expiresAt").notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const mailMessages = pgTable("mailMessages", {
  id: serial("id").primaryKey(),
  externalId: varchar("externalId", { length: 120 }).unique(),
  inboxId: integer("inboxId").notNull(),
  fromAddress: varchar("fromAddress", { length: 320 }).notNull(),
  toAddress: varchar("toAddress", { length: 320 }),
  source: varchar("source", { length: 32 }).notNull().default("MOCK"),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  type: varchar("type", { length: 8 }).notNull(),
  mode: varchar("mode", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const providerBalances = pgTable("providerBalances", {
  id: serial("id").primaryKey(),
  providerId: integer("providerId").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});
export const priceRules = pgTable("priceRules", {
  id: serial("id").primaryKey(),
  providerId: integer("providerId"),
  serviceId: varchar("serviceId", { length: 64 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
  active: integer("active").default(1).notNull(),
});
export const supportTickets = pgTable("supportTickets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subject: varchar("subject", { length: 180 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const auditLogs = pgTable(
  "auditLogs",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actorUserId"),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("targetType", { length: 80 }).notNull(),
    targetId: varchar("targetId", { length: 80 }),
    requestId: varchar("requestId", { length: 80 }),
    metadata: jsonb("metadata"),
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
