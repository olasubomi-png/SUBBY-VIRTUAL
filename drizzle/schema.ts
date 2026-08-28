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
    passwordHash: text("passwordHash"),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: varchar("role", { length: 16 }).default("user").notNull(),
    status: varchar("status", { length: 16 }).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({
    emailSearch: index("users_email_search_idx").on(table.email),
    emailUnique: uniqueIndex("users_email_unique_idx").on(table.email),
    nameSearch: index("users_name_search_idx").on(table.name),
    createdOrder: index("users_created_order_idx").on(
      table.createdAt,
      table.id
    ),
  })
);
export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("externalId", { length: 120 }).notNull().unique(),
    userId: integer("userId").notNull(),
    jobType: varchar("jobType", { length: 48 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("QUEUED"),
    payload: jsonb("payload").notNull().default({}),
    result: jsonb("result"),
    error: jsonb("error"),
    attemptCount: integer("attemptCount").notNull().default(0),
    maxAttempts: integer("maxAttempts").notNull().default(3),
    progress: integer("progress").notNull().default(0),
    nextRunAt: timestamp("nextRunAt").defaultNow().notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    cancelledAt: timestamp("cancelledAt"),
    lockedAt: timestamp("lockedAt"),
    lockedBy: varchar("lockedBy", { length: 120 }),
    recoveryCount: integer("recoveryCount").notNull().default(0),
    lastRecoveredAt: timestamp("lastRecoveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    ownerCreated: index("jobs_owner_created_idx").on(
      table.userId,
      table.createdAt,
      table.id
    ),
    statusNextRun: index("jobs_status_next_run_idx").on(
      table.status,
      table.nextRunAt,
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
    type: varchar("type", { length: 20 }).notNull(),
    amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    reference: varchar("reference", { length: 120 }).notNull().unique(),
    direction: varchar("direction", { length: 8 }),
    actorUserId: integer("actorUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    walletCreated: index("ledger_wallet_created_idx").on(
      table.walletId,
      table.createdAt
    ),
  })
);
export const pointTopUpIntents = pgTable(
  "pointTopUpIntents",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("externalId", { length: 120 }).notNull(),
    userId: integer("userId").notNull(),
    points: bigint("points", { mode: "number" }).notNull(),
    amountMinor: bigint("amountMinor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    paymentReference: varchar("paymentReference", { length: 120 }),
    idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => ({
    externalUid: uniqueIndex("point_topup_external_uidx").on(table.externalId),
    userIdempotency: uniqueIndex("point_topup_user_idempotency_uidx").on(
      table.userId,
      table.idempotencyKey
    ),
    userCreated: index("point_topup_user_created_idx").on(
      table.userId,
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
export const smsActivations = pgTable(
  "smsActivations",
  {
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
    providerCostMinor: bigint("providerCostMinor", { mode: "number" }).default(0),
    pricingVersion: varchar("pricingVersion", { length: 120 }),
    markupBps: integer("markupBps").default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
    idempotencyKey: varchar("idempotencyKey", { length: 120 }),
    providerReference: varchar("providerReference", { length: 120 }),
    verificationCode: varchar("verificationCode", { length: 32 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
    completedAt: timestamp("completedAt"),
    cancelledAt: timestamp("cancelledAt"),
  },
  table => ({
    userIdempotency: uniqueIndex("sms_activations_user_idempotency_uidx").on(
      table.userId,
      table.idempotencyKey
    ),
  })
);
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
