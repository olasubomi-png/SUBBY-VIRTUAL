import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { addDemoCredits } from "./demoState";

const base = { req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
const user = {
  id: 7,
  openId: "user-7",
  name: "Customer",
  email: "customer@example.com",
  loginMethod: "test",
  role: "user" as const,
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
const admin = { ...user, role: "admin" as const };

beforeEach(() => vi.stubEnv("DATABASE_URL", ""));
afterEach(() => vi.unstubAllEnvs());

describe("workspace authorization and validation", () => {
  it("rejects anonymous workspace access", async () => {
    const caller = appRouter.createCaller({ ...base, user: null });
    await expect(caller.workspace.summary()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects invalid SMS request input", async () => {
    const caller = appRouter.createCaller({ ...base, user });
    await expect(
      caller.workspace.createSmsRequest({ country: "", serviceId: "x" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("blocks repeated SMS requests after the abuse-control threshold", async () => {
    const caller = appRouter.createCaller({
      ...base,
      user: { ...user, id: 99 },
    });
    addDemoCredits(99, 100000, "router-rate-limit-seed");
    for (let attempt = 0; attempt < 5; attempt += 1)
      await caller.workspace.createSmsRequest({
        country: "NG",
        serviceId: "verify",
      });
    await expect(
      caller.workspace.createSmsRequest({ country: "NG", serviceId: "verify" })
    ).rejects.toThrow("Request rate limit exceeded");
  });
  it("exposes safe database health only to administrators", async () => {
    const customer = appRouter.createCaller({ ...base, user });
    const operator = appRouter.createCaller({ ...base, user: admin });
    await expect(customer.admin.databaseHealth()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const health = await operator.admin.databaseHealth();
    expect(health).toMatchObject({
      configured: expect.any(Boolean),
      reachable: expect.any(Boolean),
      persistenceMode: expect.any(String),
      migrationState: "not-inspected",
    });
    expect(JSON.stringify(health)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(health)).not.toContain("password");
  });
  it("allows admin-only overview only for administrators", async () => {
    const customer = appRouter.createCaller({ ...base, user });
    const operator = appRouter.createCaller({ ...base, user: admin });
    await expect(customer.admin.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(operator.admin.overview()).resolves.toMatchObject({
      users: expect.any(Number),
      activeProviders: expect.any(Number),
    });
  });
});

describe("additional Phase 1 validation", () => {
  it("rejects invalid mail and detail inputs", async () => {
    const caller = appRouter.createCaller({ ...base, user });
    await expect(
      caller.workspace.createMailInbox({ label: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.workspace.smsRequestDetail({ id: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.workspace.mailInboxDetail({ id: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("admin user management", () => {
  it("requires administrator authorization for search and detail", async () => {
    const anonymous = appRouter.createCaller({ ...base, user: null });
    const customer = appRouter.createCaller({ ...base, user });
    const operator = appRouter.createCaller({ ...base, user: admin });
    await expect(anonymous.admin.users({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(customer.admin.users({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      customer.admin.userDetail({ userId: 7 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(operator.admin.users({})).resolves.toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
    });
    await expect(operator.admin.userDetail({ userId: 7 })).rejects.toThrow(
      "Persistent user management requires PostgreSQL"
    );
  });

  it("bounds user search pagination and rejects invalid identifiers", async () => {
    const operator = appRouter.createCaller({ ...base, user: admin });
    await expect(
      operator.admin.users({ query: "", page: 0, pageSize: 51 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      operator.admin.users({ query: "", page: -1, pageSize: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      operator.admin.userDetail({ userId: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("admin input validation", () => {
  it("rejects invalid audit pagination", async () => {
    const caller = appRouter.createCaller({ ...base, user: admin });
    await expect(
      caller.admin.auditHistory({ limit: 0, offset: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.admin.auditHistory({ limit: 20, offset: -1 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
