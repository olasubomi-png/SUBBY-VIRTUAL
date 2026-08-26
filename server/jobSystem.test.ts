import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  createDemoActivation,
  createDemoInbox,
  getActivation,
  resetDemoState,
} from "./demoState";
import {
  appendFallbackActivity,
  claimFallbackJob,
  completeFallbackJob,
  createFallbackJob,
  failFallbackJob,
  resetFallbackJobs,
  retryFallbackJob,
} from "./jobState";
import {
  cancelUserJob,
  createJob,
  dispatchQueuedJobs,
  getAdminJobActivity,
  getAdminJobDetail,
  getAdminJobs,
  getUserJob,
  listUserJobActivity,
  listUserJobs,
} from "./jobs";
import { isRetryableJobError, parseJobPayload } from "./jobTypes";

const base = { req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
const user = {
  id: 31,
  openId: "job-user-31",
  name: "Job user",
  email: "job@example.com",
  loginMethod: "test",
  role: "user" as const,
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
const admin = { ...user, role: "admin" as const };

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("NODE_ENV", "test");
  resetFallbackJobs();
  resetDemoState();
});

afterEach(() => vi.unstubAllEnvs());

describe("fallback job lifecycle", () => {
  it("creates and completes a supported mock SMS job with activity", async () => {
    const activation = createDemoActivation({
      userId: user.id,
      country: "NG",
      serviceId: "verify",
      priceMinor: 150,
    });
    const job = await createJob({
      externalId: "job-sms-31",
      userId: user.id,
      jobType: "MOCK_SMS_DELIVERY",
      payload: { activationId: activation.id },
    });

    const summary = await dispatchQueuedJobs();
    const detail = await getUserJob(user.id, job.id);
    const activity = await listUserJobActivity(user.id, job.id);

    expect(summary).toMatchObject({ claimed: 1, completed: 1, failed: 0 });
    expect(detail).toMatchObject({ status: "COMPLETED", progress: 100 });
    expect(getActivation(user.id, activation.id).status).toBe("COMPLETED");
    expect(activity.map(event => event.eventType)).toEqual(
      expect.arrayContaining([
        "created",
        "queued",
        "processing_started",
        "progress_changed",
        "completed",
      ])
    );
  });

  it("creates and completes a supported demo email job", async () => {
    const inbox = createDemoInbox(user.id, "job inbox");
    const job = await createJob({
      externalId: "job-email-31",
      userId: user.id,
      jobType: "DEMO_EMAIL_SIMULATION",
      payload: { inboxId: inbox.id },
    });

    await expect(dispatchQueuedJobs()).resolves.toMatchObject({ completed: 1 });
    await expect(getUserJob(user.id, job.id)).resolves.toMatchObject({
      status: "COMPLETED",
      result: { kind: "email", resourceId: inbox.id },
    });
  });

  it("supports queued cancellation and prevents cancelled jobs from being claimed", async () => {
    const job = await createJob({
      externalId: "job-cancel-31",
      userId: user.id,
      jobType: "MAILBOX_EXPIRY",
      payload: { inboxId: "demo-inbox-31-missing" },
    });

    await expect(cancelUserJob(user.id, job.id)).resolves.toMatchObject({
      status: "CANCELLED",
    });
    await expect(dispatchQueuedJobs()).resolves.toMatchObject({ claimed: 0 });
    await expect(getUserJob(user.id, job.id)).resolves.toMatchObject({
      status: "CANCELLED",
    });
  });

  it("rejects cross-user access to detail and cancellation", async () => {
    const job = await createJob({
      externalId: "job-owner-31",
      userId: user.id,
      jobType: "ACTIVATION_EXPIRY",
      payload: { activationId: "demo-activation-31-missing" },
    });

    await expect(getUserJob(99, job.id)).rejects.toThrow("Job not found");
    await expect(cancelUserJob(99, job.id)).rejects.toThrow("Job not found");
  });

  it("prevents duplicate worker claims on the same queued job", () => {
    const job = createFallbackJob({
      externalId: "job-claim-31",
      userId: user.id,
      jobType: "MAILBOX_EXPIRY",
      payload: { inboxId: "demo-inbox-31" },
      maxAttempts: 3,
    });
    const first = claimFallbackJob("worker-a");
    const second = claimFallbackJob("worker-b");

    expect(first?.id).toBe(job.id);
    expect(second).toBeUndefined();
    expect(() => completeFallbackJob(first!, { ok: true }, "worker-b")).toThrow(
      "Job claim is no longer active"
    );
    completeFallbackJob(first!, { ok: true }, "worker-a");
  });

  it("schedules bounded retries and then permanently fails", () => {
    const job = createFallbackJob({
      externalId: "job-retry-31",
      userId: user.id,
      jobType: "MAILBOX_EXPIRY",
      payload: { inboxId: "demo-inbox-31" },
      maxAttempts: 2,
    });
    const first = claimFallbackJob("worker-a")!;
    const retryAt = new Date(Date.now() - 1);
    retryFallbackJob(
      first,
      { code: "TRANSIENT", message: "temporary unavailable" },
      retryAt,
      "worker-a"
    );
    const second = claimFallbackJob("worker-b")!;
    failFallbackJob(
      second,
      { code: "DOMAIN_ERROR", message: "permanent failure" },
      "worker-b"
    );

    expect(job.attemptCount).toBe(2);
    expect(job.status).toBe("FAILED");
    expect(isRetryableJobError(new Error("temporary unavailable"))).toBe(true);
    expect(isRetryableJobError(new Error("Activation not found"))).toBe(false);
  });

  it("validates supported payloads and rejects arbitrary worker inputs", () => {
    expect(
      parseJobPayload("MOCK_SMS_DELIVERY", { activationId: "a-1" })
    ).toEqual({
      activationId: "a-1",
    });
    expect(() =>
      parseJobPayload("MOCK_SMS_DELIVERY", { command: "rm -rf /" })
    ).toThrow();
    expect(() =>
      parseJobPayload("DEMO_EMAIL_SIMULATION", {
        inboxId: "i-1",
        body: "secret",
      })
    ).toThrow();
  });

  it("redacts sensitive fallback job detail, list, and activity responses", async () => {
    const job = createFallbackJob({
      externalId: "job-private-31",
      userId: user.id,
      jobType: "DEMO_EMAIL_SIMULATION",
      payload: { inboxId: "inbox-private" },
      maxAttempts: 3,
    });
    job.payload = {
      inboxId: "inbox-private",
      apiToken: "do-not-return",
      body: "private message body",
    };
    job.result = {
      delivered: true,
      secret: "do-not-return",
      message: "private result body",
    };
    job.error = {
      code: "FAILED",
      message: "safe failure",
      token: "do-not-return",
    };
    job.lockedBy = "private-worker-id";
    appendFallbackActivity(job, "failed", {
      status: "FAILED",
      apiKey: "do-not-return",
      body: "private activity body",
      attempt: 2,
    });

    const values = [
      await getUserJob(user.id, job.externalId),
      (await listUserJobs(user.id, 0, 10)).items[0],
      await getAdminJobDetail(job.externalId),
      (await getAdminJobs()).items[0],
      await listUserJobActivity(user.id, job.externalId),
      await getAdminJobActivity(),
    ];
    for (const value of values) {
      const serialized = JSON.stringify(value);
      expect(serialized).not.toContain("do-not-return");
      expect(serialized).not.toContain("private message body");
      expect(serialized).not.toContain("private-worker-id");
      expect(serialized).not.toContain("lockedBy");
    }
    expect((await getUserJob(user.id, job.externalId)).payload).toEqual({
      inboxId: "inbox-private",
    });
    expect(
      (await listUserJobActivity(user.id, job.externalId))[0].metadata
    ).toEqual({
      status: "FAILED",
      attempt: 2,
    });
  });

  it("lists bounded fallback jobs and records safe activity metadata", async () => {
    const job = createFallbackJob({
      externalId: "job-list-31",
      userId: user.id,
      jobType: "MAILBOX_EXPIRY",
      payload: { inboxId: "demo-inbox-31" },
      maxAttempts: 3,
    });
    appendFallbackActivity(job, "progress_changed", { progress: 25 });
    const page = await listUserJobs(user.id, 0, 10);
    const activity = await listUserJobActivity(user.id, job.externalId);
    expect(page).toMatchObject({ total: 1, totalPages: 1 });
    expect(page.items[0]).toMatchObject({ id: job.id, status: "QUEUED" });
    expect(activity[0]).toMatchObject({
      eventType: "progress_changed",
      metadata: { progress: 25 },
    });
  });
});

describe("job router authorization", () => {
  it("requires authentication and validates job inputs", async () => {
    const anonymous = appRouter.createCaller({ ...base, user: null });
    const caller = appRouter.createCaller({ ...base, user });

    await expect(anonymous.workspace.jobs.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller.workspace.jobs.create({
        requestId: "not-a-uuid",
        jobType: "MOCK_SMS_DELIVERY",
        payload: { activationId: "a-1" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("allows admins to view redacted metrics and job detail", async () => {
    const customer = appRouter.createCaller({ ...base, user });
    const operator = appRouter.createCaller({ ...base, user: admin });
    const job = createFallbackJob({
      externalId: "job-admin-31",
      userId: user.id,
      jobType: "MAILBOX_EXPIRY",
      payload: { inboxId: "inbox-31" },
      maxAttempts: 3,
    });

    await expect(customer.admin.jobs.metrics()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(operator.admin.jobs.metrics()).resolves.toMatchObject({
      total: 1,
      queued: 1,
    });
    const detail = await operator.admin.jobs.detail({ id: job.externalId });
    expect(detail).toMatchObject({ id: job.externalId, status: "QUEUED" });
    expect(JSON.stringify(detail)).not.toContain("lockedBy");
  });
});
