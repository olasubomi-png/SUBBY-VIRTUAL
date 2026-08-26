import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
  it("allows admin-only overview only for administrators", async () => {
    const customer = appRouter.createCaller({ ...base, user });
    const operator = appRouter.createCaller({ ...base, user: admin });
    await expect(customer.admin.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(operator.admin.overview()).resolves.toMatchObject({
      users: expect.any(Number),
      activeProviders: 2,
    });
  });
});
