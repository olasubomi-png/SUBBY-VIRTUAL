ALTER TABLE "jobs" ADD COLUMN "recoveryCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "lastRecoveredAt" timestamp;