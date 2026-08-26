export type ConfiguredDatabaseMode = "postgresql" | "unsupported" | "fallback";

export function getConfiguredDatabaseMode(
  databaseUrl = process.env.DATABASE_URL
): ConfiguredDatabaseMode {
  if (!databaseUrl) return "fallback";
  try {
    const protocol = new URL(databaseUrl).protocol;
    return protocol === "postgres:" || protocol === "postgresql:"
      ? "postgresql"
      : "unsupported";
  } catch {
    return "unsupported";
  }
}

export function shouldUsePersistentStore() {
  const mode = getConfiguredDatabaseMode();
  if (process.env.NODE_ENV === "production" && mode !== "postgresql") {
    throw new Error("PostgreSQL DATABASE_URL is required in production");
  }
  return mode === "postgresql";
}

export function getPersistenceModeLabel(
  configuredMode: ConfiguredDatabaseMode,
  reachable?: boolean
) {
  if (configuredMode === "fallback") return "development-fallback" as const;
  if (configuredMode === "unsupported") return "unsupported-database" as const;
  if (reachable === false) return "postgresql-unavailable" as const;
  return "postgresql" as const;
}
