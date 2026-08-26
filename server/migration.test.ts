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
    new URL("../drizzle/meta/0005_snapshot.json", import.meta.url),
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

describe("PostgreSQL migration contract", () => {
  it("keeps the Drizzle journal ordered and PostgreSQL-specific", () => {
    expect(journal.dialect).toBe("postgresql");
    expect(snapshot.dialect).toBe("postgresql");
    expect(journal.entries.map(entry => entry.idx)).toEqual(
      journal.entries.map((_, index) => index)
    );
    expect(journal.entries.at(-1)?.tag).toBe("0005_closed_skullbuster");
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
