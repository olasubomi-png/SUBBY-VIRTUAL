import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("database connection boundary", () => {
  it("fails closed in production when PostgreSQL is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    await expect(getDb()).rejects.toThrow(
      "PostgreSQL DATABASE_URL is required in production"
    );
  });
});
