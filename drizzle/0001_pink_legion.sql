ALTER TABLE "auditLogs" ALTER COLUMN "metadata" SET DATA TYPE jsonb USING "metadata"::jsonb;--> statement-breakpoint
ALTER TABLE "auditLogs" ADD COLUMN "requestId" varchar(80);--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "providerType" varchar(16) DEFAULT 'MOCK' NOT NULL;--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "quotedPriceMinor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "currency" varchar(3) DEFAULT 'NGN' NOT NULL;--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "temporaryInboxes" ADD COLUMN "domain" varchar(255) DEFAULT 'subby.demo' NOT NULL;--> statement-breakpoint
ALTER TABLE "temporaryInboxes" ADD COLUMN "deletedAt" timestamp;
