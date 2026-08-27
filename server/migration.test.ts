import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const journal = JSON.parse(
  readFileSync(
    new URL("../drizzle/meta/_journal.json", import.meta.url),
    "utf8"
  )
) as {
  dialect: string;
  entries: Array<{ idx: number; tag: string }>;
};
const snapshot = JSON.parse(
  readFileSync(
    new URL("../drizzle/meta/0007_snapshot.json", import.meta.url),
    "utf8"
  )
) as {
  dialect: string;
  tables: Record<string, { columns: Record<string, unknown> }>;
};
const migration = readFileSync(
  new URL("../drizzle/0004_great_devos.sql", import.meta.url),
  "utf8"
);
const auditLogMigration = readFileSync(
  new URL("../drizzle/0001_pink_legion.sql", import.meta.url),
  "utf8"
);

describe("PostgreSQL migration contract", () => {
  it("keeps the Drizzle journal ordered and PostgreSQL-specific", () => {
    expect(journal.dialect).toBe("postgresql");
    expect(snapshot.dialect).toBe("postgresql");
    expect(journal.entries.map(entry => entry.idx)).toEqual(
      journal.entries.map((_, index) => index)
    );
    expect(journal.entries.at(-1)?.tag).toBe("0007_modern_eternals");
  });

  it("casts existing audit-log metadata explicitly when converting to jsonb", () => {
    expect(auditLogMigration).toContain(
      'ALTER TABLE "auditLogs" ALTER COLUMN "metadata" SET DATA TYPE jsonb USING "metadata"::jsonb;--> statement-breakpoint'
    );
  });

  it("matches message columns and uses additive unique constraints", () => {
    expect(
      Object.keys(snapshot.tables["public.smsMessages"].columns)
    ).toContain("externalId");
    expect(
      Object.keys(snapshot.tables["public.mailMessages"].columns)
    ).toContain("externalId");
    expect(migration).toContain(
      'ALTER TABLE "smsMessages" ADD COLUMN "externalId" varchar(120);'
    );
    expect(migration).toContain(
      'ALTER TABLE "mailMessages" ADD COLUMN "externalId" varchar(120);'
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "smsMessages_externalId_unique" UNIQUE("externalId")'
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "mailMessages_externalId_unique" UNIQUE("externalId")'
    );
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|CREATE TABLE/);
  });

  it("keeps the jobs schema and claim indexes additive and explicit", () => {
    const jobsMigration = readFileSync(
      new URL("../drizzle/0006_smooth_dust.sql", import.meta.url),
      "utf8"
    );
    const jobColumns = Object.keys(snapshot.tables["public.jobs"].columns);
    expect(jobColumns).toEqual(
      expect.arrayContaining([
        "externalId",
        "userId",
        "jobType",
        "status",
        "payload",
        "result",
        "error",
        "attemptCount",
        "maxAttempts",
        "progress",
        "nextRunAt",
        "startedAt",
        "completedAt",
        "cancelledAt",
        "lockedAt",
        "lockedBy",
        "recoveryCount",
        "lastRecoveredAt",
      ])
    );
    expect(jobsMigration).toContain('CREATE TABLE "jobs"');
    expect(jobsMigration).toContain('CREATE INDEX "jobs_owner_created_idx"');
    expect(jobsMigration).toContain('CREATE INDEX "jobs_status_next_run_idx"');
    expect(jobsMigration).not.toMatch(/DROP TABLE|DROP COLUMN/);
  });

  it("keeps admin user-search indexes additive and explicit", () => {
    const indexMigration = readFileSync(
      new URL("../drizzle/0005_closed_skullbuster.sql", import.meta.url),
      "utf8"
    );
    expect(indexMigration).toContain('CREATE INDEX "users_email_search_idx"');
    expect(indexMigration).toContain('CREATE INDEX "users_name_search_idx"');
    expect(indexMigration).toContain('CREATE INDEX "users_created_order_idx"');
    expect(indexMigration).not.toMatch(/DROP TABLE|DROP COLUMN|ALTER TABLE/);
  });
});
