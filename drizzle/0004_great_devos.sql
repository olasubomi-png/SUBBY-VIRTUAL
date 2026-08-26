ALTER TABLE "mailMessages" ADD COLUMN "externalId" varchar(120);--> statement-breakpoint
ALTER TABLE "smsMessages" ADD COLUMN "externalId" varchar(120);--> statement-breakpoint
ALTER TABLE "mailMessages" ADD CONSTRAINT "mailMessages_externalId_unique" UNIQUE("externalId");--> statement-breakpoint
ALTER TABLE "smsMessages" ADD CONSTRAINT "smsMessages_externalId_unique" UNIQUE("externalId");