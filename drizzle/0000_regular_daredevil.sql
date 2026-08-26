CREATE TABLE "auditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorUserId" integer,
	"action" varchar(120) NOT NULL,
	"targetType" varchar(80) NOT NULL,
	"targetId" varchar(80),
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mailMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"inboxId" integer NOT NULL,
	"fromAddress" varchar(320) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priceRules" (
	"id" serial PRIMARY KEY NOT NULL,
	"providerId" integer,
	"serviceId" varchar(64) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amountMinor" bigint NOT NULL,
	"active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providerBalances" (
	"id" serial PRIMARY KEY NOT NULL,
	"providerId" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amountMinor" bigint NOT NULL,
	"checkedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" varchar(8) NOT NULL,
	"mode" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smsActivations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"providerId" integer,
	"countryCode" varchar(3) NOT NULL,
	"serviceId" varchar(64) NOT NULL,
	"phoneNumber" varchar(32),
	"status" varchar(16) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smsMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"activationId" integer NOT NULL,
	"body" text NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supportTickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"subject" varchar(180) NOT NULL,
	"status" varchar(16) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temporaryInboxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"providerId" integer,
	"address" varchar(320) NOT NULL,
	"status" varchar(16) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "temporaryInboxes_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"walletId" integer NOT NULL,
	"kind" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"amountMinor" bigint NOT NULL,
	"reference" varchar(120) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "walletLedgerEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"walletId" integer NOT NULL,
	"type" varchar(8) NOT NULL,
	"amountMinor" bigint NOT NULL,
	"reason" varchar(120) NOT NULL,
	"reference" varchar(120) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "walletLedgerEntries_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_action_created_idx" ON "auditLogs" USING btree ("action","createdAt");--> statement-breakpoint
CREATE INDEX "ledger_wallet_created_idx" ON "walletLedgerEntries" USING btree ("walletId","createdAt");--> statement-breakpoint
CREATE INDEX "wallet_user_currency_idx" ON "wallets" USING btree ("userId","currency");