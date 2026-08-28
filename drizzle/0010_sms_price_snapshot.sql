ALTER TABLE "smsActivations" ADD COLUMN "providerCostMinor" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "pricingVersion" varchar(120);--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "markupBps" integer DEFAULT 0;
