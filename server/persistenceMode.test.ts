import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConfiguredDatabaseMode,
  getPersistenceModeLabel,
  shouldUsePersistentStore,
} from "./persistenceMode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("persistence mode", () => {
  it("recognizes PostgreSQL URLs and rejects unsupported protocols", () => {
    expect(
      getConfiguredDatabaseMode("postgresql://user:pass@localhost/db")
    ).toBe("postgresql");
    expect(getConfiguredDatabaseMode("mysql://user:pass@localhost/db")).toBe(
      "unsupported"
    );
    expect(getConfiguredDatabaseMode("")).toBe("fallback");
  });

  it("labels unreachable PostgreSQL without exposing connection details", () => {
    expect(getPersistenceModeLabel("postgresql", false)).toBe(
      "postgresql-unavailable"
    );
    expect(getPersistenceModeLabel("fallback")).toBe("development-fallback");
  });

  it("fails closed instead of silently using memory in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    expect(() => shouldUsePersistentStore()).toThrow(
      "PostgreSQL DATABASE_URL is required in production"
    );
  });

  it("allows the development fallback when PostgreSQL is intentionally absent", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    expect(shouldUsePersistentStore()).toBe(false);
  });
});
