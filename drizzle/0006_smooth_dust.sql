CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"externalId" varchar(120) NOT NULL,
	"userId" integer NOT NULL,
	"jobType" varchar(48) NOT NULL,
	"status" varchar(16) DEFAULT 'QUEUED' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" jsonb,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 3 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"nextRunAt" timestamp DEFAULT now() NOT NULL,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"lockedAt" timestamp,
	"lockedBy" varchar(120),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_externalId_unique" UNIQUE("externalId")
);
--> statement-breakpoint
CREATE INDEX "jobs_owner_created_idx" ON "jobs" USING btree ("userId","createdAt","id");--> statement-breakpoint
CREATE INDEX "jobs_status_next_run_idx" ON "jobs" USING btree ("status","nextRunAt","createdAt","id");