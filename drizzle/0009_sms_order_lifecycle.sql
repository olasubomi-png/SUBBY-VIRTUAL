ALTER TABLE "smsActivations" ADD COLUMN "idempotencyKey" varchar(120);--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "providerReference" varchar(120);--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "verificationCode" varchar(32);--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "cancelledAt" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "sms_activations_user_idempotency_uidx" ON "smsActivations" USING btree ("userId","idempotencyKey");
