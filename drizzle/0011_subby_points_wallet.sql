ALTER TABLE "walletLedgerEntries" ALTER COLUMN "type" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "walletLedgerEntries" ADD COLUMN "direction" varchar(8);--> statement-breakpoint
ALTER TABLE "walletLedgerEntries" ADD COLUMN "actorUserId" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pointTopUpIntents" (
  "id" serial PRIMARY KEY NOT NULL,
  "externalId" varchar(120) NOT NULL,
  "userId" integer NOT NULL,
  "points" bigint NOT NULL,
  "amountMinor" bigint NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  "paymentReference" varchar(120),
  "idempotencyKey" varchar(120) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "point_topup_external_uidx" ON "pointTopUpIntents" USING btree ("externalId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "point_topup_user_idempotency_uidx" ON "pointTopUpIntents" USING btree ("userId","idempotencyKey");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_topup_user_created_idx" ON "pointTopUpIntents" USING btree ("userId","createdAt");
