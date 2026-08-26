import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs, jobs } from "../drizzle/schema";
import {
  claimNextPersistentJob,
  completePersistentJob,
  createPersistentJob,
  getPersistentAdminJob,
  getPersistentJob,
  listPersistentAdminJobActivity,
  listPersistentJobActivity,
  settlePersistentJobFailure,
  updatePersistentJobProgress,
  cancelPersistentJob,
  recoverStalePersistentJobs,
} from "./persistence";

const getDb = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb }));

const userId = 71;
const workerId = "worker-persistent-test";

function createFakeDb() {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const state = {
    jobs: [] as any[],
    audits: [] as any[],
    nextJobId: 1,
    nextAuditId: 1,
  };

  const readRows = (table: unknown) => {
    if (table === jobs) return state.jobs;
    if (table === auditLogs) return state.audits;
    return [];
  };

  const select = (selection?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      const rows = () => {
        const source = readRows(table);
        if (table !== auditLogs || !selection) return source;
        return source
          .slice()
          .sort((left, right) => right.id - left.id)
          .map(row => ({
            id: row.id,
            eventType: row.action,
            metadata: row.metadata,
            createdAt: row.createdAt,
          }));
      };
      const chain = {
        where: () => chain,
        orderBy: () => chain,
        limit: async () => rows(),
        offset: async () => rows(),
      };
      return chain;
    },
  });

  const insert = (table: unknown) => ({
    values: (value: any) => {
      const chain: any = {
        onConflictDoNothing: () => chain,
        returning: async () => {
          if (table === jobs) {
            const row = {
              id: state.nextJobId++,
              externalId: value.externalId,
              userId: value.userId,
              jobType: value.jobType,
              status: "QUEUED",
              payload: value.payload,
              result: null,
              error: null,
              attemptCount: 0,
              maxAttempts: value.maxAttempts,
              progress: 0,
              nextRunAt: now,
              startedAt: null,
              completedAt: null,
              cancelledAt: null,
              lockedAt: null,
              lockedBy: null,
              recoveryCount: 0,
              lastRecoveredAt: null,
              createdAt: now,
              updatedAt: now,
            };
            state.jobs.push(row);
            return [row];
          }
          const row = { id: state.nextAuditId++, ...value, createdAt: now };
          state.audits.push(row);
          return [row];
        },
      };
      return chain;
    },
  });

  const update = (table: unknown) => ({
    set: (changes: Record<string, unknown>) => ({
      where: () => ({
        returning: async () => {
          const row = table === jobs ? state.jobs[0] : undefined;
          if (!row) return [];
          const normalized = { ...changes };
          if ("recoveryCount" in normalized)
            normalized.recoveryCount = row.recoveryCount + 1;
          Object.assign(row, normalized);
          return [row];
        },
      }),
    }),
  });

  const db = {
    select,
    insert,
    update,
    transaction: async (callback: (tx: typeof db) => Promise<unknown>) =>
      callback(db),
    execute: async () => {
      const row = state.jobs.find(
        candidate =>
          candidate.status === "QUEUED" || candidate.status === "RETRYING"
      );
      if (!row) return { rows: [] };
      Object.assign(row, {
        status: "PROCESSING",
        attemptCount: row.attemptCount + 1,
        startedAt: row.startedAt ?? now,
        lockedAt: now,
        lockedBy: workerId,
        updatedAt: now,
      });
      return { rows: [row] };
    },
  };

  return { db, state };
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test.invalid/subby");
});

afterEach(() => vi.unstubAllEnvs());

describe("persistent job repository and audit activity", () => {
  it("writes and reads the complete durable lifecycle through auditLogs", async () => {
    const fake = createFakeDb();
    getDb.mockResolvedValue(fake.db);

    await createPersistentJob({
      externalId: "persistent-job-1",
      userId,
      jobType: "MOCK_SMS_DELIVERY",
      payload: { activationId: "activation-1" },
      maxAttempts: 3,
    });
    await claimNextPersistentJob(workerId);
    await updatePersistentJobProgress(
      1,
      workerId,
      55,
      userId,
      "persistent-job-1"
    );
    await completePersistentJob(1, workerId, userId, "persistent-job-1", {
      kind: "sms",
      completed: true,
    });

    const activity = await listPersistentJobActivity(
      userId,
      "persistent-job-1",
      50
    );
    const actions = activity.map(event => event.eventType);
    expect(actions).toEqual([
      "job.completed",
      "job.progress_changed",
      "job.processing_started",
      "job.queued",
      "job.created",
    ]);
    expect(fake.state.audits).toHaveLength(5);
    expect((await getPersistentJob(userId, "persistent-job-1")).status).toBe(
      "COMPLETED"
    );
  });

  it("persists retry and cancellation transitions as separate audit events", async () => {
    const fake = createFakeDb();
    getDb.mockResolvedValue(fake.db);

    await createPersistentJob({
      externalId: "persistent-job-2",
      userId,
      jobType: "MAILBOX_EXPIRY",
      payload: { inboxId: "inbox-2" },
      maxAttempts: 3,
    });
    fake.state.jobs[0].status = "PROCESSING";
    fake.state.jobs[0].lockedBy = workerId;
    fake.state.jobs[0].lockedAt = new Date();
    await settlePersistentJobFailure({
      jobId: 1,
      workerId,
      userId,
      externalId: "persistent-job-2",
      error: { code: "TRANSIENT", message: "temporary issue" },
      retryAt: new Date("2026-08-26T12:00:10.000Z"),
    });
    expect(fake.state.jobs[0].status).toBe("RETRYING");
    expect(fake.state.audits.at(-1)?.action).toBe("job.retry_scheduled");

    const cancelFake = createFakeDb();
    getDb.mockResolvedValue(cancelFake.db);
    const cancelJob = await createPersistentJob({
      externalId: "persistent-job-3",
      userId,
      jobType: "ACTIVATION_EXPIRY",
      payload: { activationId: "activation-3" },
      maxAttempts: 3,
    });
    expect(cancelJob.status).toBe("QUEUED");
    await cancelPersistentJob(userId, "persistent-job-3");
    expect(cancelFake.state.audits.at(-1)?.action).toBe("job.cancelled");
  });

  it("recovers a stale durable processing claim and audits the transition", async () => {
    const fake = createFakeDb();
    getDb.mockResolvedValue(fake.db);
    await createPersistentJob({
      externalId: "persistent-stale-job",
      userId,
      jobType: "MOCK_SMS_DELIVERY",
      payload: { activationId: "activation-stale" },
      maxAttempts: 3,
    });
    Object.assign(fake.state.jobs[0], {
      status: "PROCESSING",
      attemptCount: 1,
      lockedBy: "dead-worker",
      lockedAt: new Date("2026-08-26T10:00:00.000Z"),
      updatedAt: new Date("2026-08-26T10:00:00.000Z"),
    });
    const recovered = await recoverStalePersistentJobs(
      new Date("2026-08-26T12:00:00.000Z"),
      5 * 60_000
    );
    expect(recovered[0]).toMatchObject({
      status: "RETRYING",
      recoveryCount: 1,
    });
    expect(fake.state.jobs[0].lockedBy).toBeNull();
    expect(fake.state.audits.at(-1)?.action).toBe("job.stale_recovered");
  });

  it("redacts payload, result, error, lock metadata, and audit activity for user and admin reads", async () => {
    const fake = createFakeDb();
    getDb.mockResolvedValue(fake.db);
    await createPersistentJob({
      externalId: "persistent-job-private",
      userId,
      jobType: "DEMO_EMAIL_SIMULATION",
      payload: {
        inboxId: "inbox-private",
        apiToken: "do-not-return",
        body: "private message body",
      },
      maxAttempts: 3,
    });
    Object.assign(fake.state.jobs[0], {
      result: {
        delivered: true,
        body: "private result body",
        secret: "do-not-return",
      },
      error: {
        code: "FAILED",
        message: "safe failure",
        token: "do-not-return",
      },
      lockedBy: "private-worker-id",
      lockedAt: new Date(),
    });
    fake.state.audits.push({
      id: 99,
      action: "job.failed",
      targetType: "job",
      targetId: "persistent-job-private",
      actorUserId: userId,
      metadata: {
        status: "FAILED",
        body: "private activity body",
        apiKey: "do-not-return",
        attempt: 2,
      },
      createdAt: new Date(),
    });

    const userDetail = await getPersistentJob(userId, "persistent-job-private");
    const adminDetail = await getPersistentAdminJob("persistent-job-private");
    const activity = await listPersistentJobActivity(
      userId,
      "persistent-job-private"
    );
    const adminActivity = await listPersistentAdminJobActivity();
    for (const value of [userDetail, adminDetail, activity, adminActivity]) {
      const serialized = JSON.stringify(value);
      expect(serialized).not.toContain("do-not-return");
      expect(serialized).not.toContain("private message body");
      expect(serialized).not.toContain("private-worker-id");
      expect(serialized).not.toContain("lockedBy");
    }
    expect(userDetail.payload).toEqual({ inboxId: "inbox-private" });
    expect(userDetail.result).toEqual({ delivered: true });
    expect(activity[0].metadata).toEqual({ status: "FAILED", attempt: 2 });
  });
});
