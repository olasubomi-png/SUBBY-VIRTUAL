ALTER TABLE "pointTopUpIntents" ADD COLUMN IF NOT EXISTS "packageId" varchar(64);--> statement-breakpoint
ALTER TABLE "pointTopUpIntents" ADD COLUMN IF NOT EXISTS "provider" varchar(16);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "point_topup_payment_ref_uidx" ON "pointTopUpIntents" USING btree ("paymentReference");
