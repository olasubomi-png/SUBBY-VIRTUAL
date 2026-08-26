DROP INDEX "wallet_user_currency_idx";--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "expiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "completedAt" timestamp;--> statement-breakpoint
ALTER TABLE "smsMessages" ADD COLUMN "sender" varchar(320) DEFAULT 'demo.sender' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_user_currency_unique" ON "wallets" USING btree ("userId","currency");