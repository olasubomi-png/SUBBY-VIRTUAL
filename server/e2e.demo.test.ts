import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { dispatchQueuedJobs, getUserJob } from "./jobs";
import type { TrpcContext } from "./_core/context";

const contextFor = (id: number): TrpcContext => ({
  user: {
    id,
    openId: `e2e-${id}`,
    name: "E2E User",
    email: `e2e-${id}@example.com`,
    loginMethod: "test",
    role: "user",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("Step 2 end-to-end demo flow", () => {
  it("funds, spends, completes SMS, and receives temporary mail safely", async () => {
    const caller = appRouter.createCaller(contextFor(7001));
    const credits = await caller.workspace.addDemoCredits({
      amountMinor: 100000,
      requestId: "00000000-0000-4000-8000-000000000001",
    });
    expect(credits.balanceMinor).toBe(100000);
    const activation = await caller.workspace.createSmsRequest({
      country: "NG",
      serviceId: "verify",
    });
    expect(activation.status).toBe("ACTIVE");
    expect(activation.walletBalanceMinor).toBe(85000);
    const smsJob = await caller.workspace.simulateSms({ id: activation.id });
    expect(smsJob.status).toBe("QUEUED");
    await dispatchQueuedJobs();
    const completed = await caller.workspace.smsRequestDetail({
      id: activation.id,
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.message?.body).toContain("482913");
    const inbox = await caller.workspace.createMailInbox({
      label: "verification",
    });
    expect(inbox.address).toContain("@subby.demo");
    const emailJob = await caller.workspace.simulateEmail({ id: inbox.id });
    expect(emailJob.status).toBe("QUEUED");
    await dispatchQueuedJobs();
    const received = await caller.workspace.mailInboxDetail({ id: inbox.id });
    expect(received.messages).toHaveLength(1);
    const wallet = await caller.workspace.wallet();
    expect(wallet.balanceMinor).toBe(85000);
    const summary = await caller.workspace.summary();
    expect(summary.balance.NGN).toBe(85000);
    expect(wallet.ledger.map(entry => entry.type)).toEqual(["DEBIT", "CREDIT"]);
  });

  it("enforces cancellation and expiry transitions", async () => {
    const caller = appRouter.createCaller(contextFor(7004));
    await caller.workspace.addDemoCredits({
      amountMinor: 100000,
      requestId: "00000000-0000-4000-8000-000000000004",
    });
    const activation = await caller.workspace.createSmsRequest({
      country: "NG",
      serviceId: "verify",
    });
    const cancelled = await caller.workspace.cancelSms({ id: activation.id });
    expect(cancelled.status).toBe("CANCELLED");
    await expect(
      caller.workspace.simulateSms({ id: activation.id })
    ).rejects.toThrow("Invalid activation state");
    const inbox = await caller.workspace.createMailInbox({ label: "expiry" });
    const expired = await caller.workspace.expireInbox({ id: inbox.id });
    expect(expired.status).toBe("EXPIRED");
    await expect(
      caller.workspace.simulateEmail({ id: inbox.id })
    ).rejects.toThrow("Inbox is expired");
  });

  it("prevents one user from reading another user's activation or inbox", async () => {
    const owner = appRouter.createCaller(contextFor(7002));
    const other = appRouter.createCaller(contextFor(7003));
    await owner.workspace.addDemoCredits({
      amountMinor: 100000,
      requestId: "00000000-0000-4000-8000-000000000002",
    });
    const activation = await owner.workspace.createSmsRequest({
      country: "GB",
      serviceId: "sandbox",
    });
    const inbox = await owner.workspace.createMailInbox({ label: "private" });
    await expect(
      other.workspace.simulateSms({ id: activation.id })
    ).rejects.toThrow("Activation not found");
    await expect(
      other.workspace.simulateEmail({ id: inbox.id })
    ).rejects.toThrow("Inbox not found");
  });
});

describe("duplicate simulation protection", () => {
  it("does not create duplicate fallback messages", async () => {
    const caller = appRouter.createCaller(contextFor(7010));
    await caller.workspace.addDemoCredits({
      amountMinor: 100000,
      requestId: "00000000-0000-4000-8000-000000000010",
    });
    const activation = await caller.workspace.createSmsRequest({
      country: "NG",
      serviceId: "verify",
    });
    const firstSms = await caller.workspace.simulateSms({ id: activation.id });
    const secondSms = await caller.workspace.simulateSms({ id: activation.id });
    expect(secondSms.id).toBe(firstSms.id);
    await dispatchQueuedJobs();
    const inbox = await caller.workspace.createMailInbox({ label: "dedupe" });
    const firstEmail = await caller.workspace.simulateEmail({ id: inbox.id });
    const secondEmail = await caller.workspace.simulateEmail({ id: inbox.id });
    expect(secondEmail.id).toBe(firstEmail.id);
    await dispatchQueuedJobs();
    expect((await getUserJob(7010, firstSms.id)).status).toBe("COMPLETED");
    expect((await getUserJob(7010, firstEmail.id)).status).toBe("COMPLETED");
  });
});
