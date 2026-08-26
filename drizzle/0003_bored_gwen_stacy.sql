ALTER TABLE "mailMessages" ADD COLUMN "toAddress" varchar(320);--> statement-breakpoint
ALTER TABLE "mailMessages" ADD COLUMN "source" varchar(32) DEFAULT 'MOCK' NOT NULL;--> statement-breakpoint
ALTER TABLE "smsActivations" ADD COLUMN "externalId" varchar(120);--> statement-breakpoint
ALTER TABLE "smsMessages" ADD COLUMN "recipient" varchar(320);--> statement-breakpoint
ALTER TABLE "smsMessages" ADD COLUMN "source" varchar(32) DEFAULT 'MOCK' NOT NULL;--> statement-breakpoint
ALTER TABLE "temporaryInboxes" ADD COLUMN "externalId" varchar(120);--> statement-breakpoint
ALTER TABLE "smsActivations" ADD CONSTRAINT "smsActivations_externalId_unique" UNIQUE("externalId");--> statement-breakpoint
ALTER TABLE "smsMessages" ADD CONSTRAINT "smsMessages_activationId_unique" UNIQUE("activationId");--> statement-breakpoint
ALTER TABLE "temporaryInboxes" ADD CONSTRAINT "temporaryInboxes_externalId_unique" UNIQUE("externalId");