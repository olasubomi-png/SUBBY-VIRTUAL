import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertUser, User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  getConfiguredDatabaseMode,
  getPersistenceModeLabel,
} from "./persistenceMode";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  const configuredMode = getConfiguredDatabaseMode(databaseUrl);
  if (process.env.NODE_ENV === "production" && configuredMode !== "postgresql")
    throw new Error("PostgreSQL DATABASE_URL is required in production");
  if (!_db && databaseUrl && configuredMode === "postgresql") {
    try {
      _pool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl:
          databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
            ? undefined
            : { rejectUnauthorized: true },
      });
      _pool.on("error", () => {
        console.warn("[Database] PostgreSQL connection error");
      });
      await _pool.query("select 1");
      _db = drizzle(_pool);
    } catch {
      console.warn("[Database] PostgreSQL is unavailable");
      if (_pool) await _pool.end().catch(() => undefined);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export async function getDatabaseHealth() {
  const configuredMode = getConfiguredDatabaseMode(process.env.DATABASE_URL);
  if (configuredMode !== "postgresql") {
    return {
      configured: configuredMode !== "fallback",
      dialect: configuredMode === "fallback" ? "none" : "unsupported",
      reachable: false,
      persistenceMode: getPersistenceModeLabel(configuredMode, false),
      migrationState: "not-inspected" as const,
    };
  }

  await getDb();
  if (!_pool) {
    return {
      configured: true,
      dialect: "postgresql" as const,
      reachable: false,
      persistenceMode: "postgresql-unavailable" as const,
      migrationState: "not-inspected" as const,
    };
  }

  try {
    await _pool.query("select 1");
    return {
      configured: true,
      dialect: "postgresql" as const,
      reachable: true,
      persistenceMode: "postgresql" as const,
      migrationState: "not-inspected" as const,
    };
  } catch {
    return {
      configured: true,
      dialect: "postgresql" as const,
      reachable: false,
      persistenceMode: "postgresql-unavailable" as const,
      migrationState: "not-inspected" as const,
    };
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production")
      throw new Error("PostgreSQL database is unavailable");
    return;
  }
  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role: user.role ?? "user",
    status: user.status ?? "active",
  };
  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.openId,
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: values.lastSignedIn,
        role: values.role,
        status: values.status,
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production")
      throw new Error("PostgreSQL database is unavailable");
    return undefined;
  }
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("PostgreSQL database is unavailable");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("PostgreSQL database is unavailable");
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0];
}

export async function insertLocalUser(input: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("PostgreSQL database is unavailable");
  const result = await db
    .insert(users)
    .values({
      openId: input.openId,
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      loginMethod: "password",
      role: input.role,
      status: "active",
      lastSignedIn: new Date(),
    })
    .returning();
  const user = result[0];
  if (!user) throw new Error("Failed to create user");
  return user;
}

export async function closeDb() {
  if (_pool) await _pool.end();
  _pool = null;
  _db = null;
}
