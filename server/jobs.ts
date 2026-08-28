import {
  expirePersistentActivation,
  expirePersistentInbox,
  completePersistentActivation,
  getPersistentInbox,
  getPersistentActivation,
  persistCompletedInboxMessage,
  claimNextPersistentJob,
  completePersistentJob,
  createPersistentJob,
  getPersistentJobMetrics,
  getPersistentAdminJob,
  listPersistentAdminJobActivity,
  listPersistentAdminJobs,
  listPersistentJobActivity,
  listPersistentJobs,
  getPersistentJob,
  cancelPersistentJob,
  settlePersistentJobFailure,
  updatePersistentJobProgress,
  recoverStalePersistentJobs,
} from "./persistence";
import { shouldUsePersistentStore } from "./persistenceMode";
import { expireDemoResources } from "./jobsCleanup";
import {
  JOB_TYPES,
  isRetryableJobError,
  parseJobPayload,
  safeJobError,
  safeJobMetadata,
  type JobStatus,
  type JobType,
} from "./jobTypes";
import {
  cancelFallbackJob,
  claimFallbackJob,
  completeFallbackJob,
  createFallbackJob,
  failFallbackJob,
  getFallbackJob,
  getFallbackJobByExternalId,
  listAllFallbackJobActivity,
  listAllFallbackJobs,
  listFallbackJobActivity,
  listFallbackJobs,
  retryFallbackJob,
  updateFallbackJobProgress,
  recoverStaleFallbackJobs,
  type FallbackJob,
} from "./jobState";
import {
  expireActivation,
  expireInbox,
  getActivation,
  getInbox,
  simulateEmail,
  simulateSms,
} from "./demoState";

export { expireDemoResources } from "./jobsCleanup";

export { JOB_TYPES };

function safeFallbackActivity(
  events: Array<{
    id: string;
    jobId?: string;
    eventType: string;
    metadata: unknown;
    createdAt: string;
  }>
) {
  return events.map(event => ({
    id: event.id,
    jobId: event.jobId,
    eventType: event.eventType,
    metadata: safeJobMetadata(event.metadata),
    createdAt: event.createdAt,
  }));
}

function safeFallbackJob(job: FallbackJob) {
  return {
    id: job.externalId,
    userId: job.userId,
    jobType: job.jobType,
    status: job.status,
    payload: safeJobMetadata(job.payload),
    result: job.result ? safeJobMetadata(job.result) : undefined,
    error: job.error
      ? {
          code: job.error.code,
          message: job.error.message.slice(0, 200),
        }
      : undefined,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    updatedAt: job.updatedAt,
    nextRunAt: job.nextRunAt,
    recoveryCount: job.recoveryCount,
    lastRecoveredAt: job.lastRecoveredAt,
  };
}

export async function queueSmsSimulationJob(
  userId: number,
  activationId: string
) {
  const externalId = `sms-simulation-${userId}-${activationId}`;
  if (shouldUsePersistentStore()) {
    try {
      return await getPersistentJob(userId, externalId);
    } catch (error) {
      if (error instanceof Error && error.message !== "Job not found")
        throw error;
      const activation = await getPersistentActivation(userId, activationId);
      const activeStatuses = new Set(["ACTIVE", "active", "WAITING"]);
      if (!activeStatuses.has(activation.status))
        throw new Error("Invalid activation state");
      return createJob({
        externalId,
        userId,
        jobType: "MOCK_SMS_DELIVERY",
        payload: { activationId },
      });
    }
  }
  const existing = getFallbackJobByExternalId(externalId);
  if (existing) return safeFallbackJob(existing);
  const activation = getActivation(userId, activationId);
  const activeStatuses = new Set(["ACTIVE", "active", "WAITING"]);
  if (!activeStatuses.has(activation.status))
    throw new Error("Invalid activation state");
  return createJob({
    externalId,
    userId,
    jobType: "MOCK_SMS_DELIVERY",
    payload: { activationId },
  });
}

export async function queueEmailSimulationJob(userId: number, inboxId: string) {
  const externalId = `email-simulation-${userId}-${inboxId}`;
  if (shouldUsePersistentStore()) {
    try {
      return await getPersistentJob(userId, externalId);
    } catch (error) {
      if (error instanceof Error && error.message !== "Job not found")
        throw error;
      const inbox = await getPersistentInbox(userId, inboxId);
      if (inbox.status !== "ACTIVE") throw new Error("Inbox is expired");
      return createJob({
        externalId,
        userId,
        jobType: "DEMO_EMAIL_SIMULATION",
        payload: { inboxId },
      });
    }
  }
  const existing = getFallbackJobByExternalId(externalId);
  if (existing) return safeFallbackJob(existing);
  const inbox = getInbox(userId, inboxId);
  if (inbox.status !== "ACTIVE") throw new Error("Inbox is expired");
  return createJob({
    externalId,
    userId,
    jobType: "DEMO_EMAIL_SIMULATION",
    payload: { inboxId },
  });
}

export async function createJob(input: {
  externalId: string;
  userId: number;
  jobType: JobType;
  payload: Record<string, string>;
  maxAttempts?: number;
}) {
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 3, 5));
  return shouldUsePersistentStore()
    ? createPersistentJob({ ...input, maxAttempts })
    : createFallbackJob({ ...input, maxAttempts });
}

export async function listUserJobs(userId: number, page = 0, pageSize = 20) {
  if (shouldUsePersistentStore())
    return listPersistentJobs(userId, page, pageSize);
  const pageData = listFallbackJobs(userId, page, Math.min(pageSize, 50));
  return { ...pageData, items: pageData.items.map(safeFallbackJob) };
}

export async function getUserJob(userId: number, externalId: string) {
  if (shouldUsePersistentStore()) return getPersistentJob(userId, externalId);
  return safeFallbackJob(getFallbackJob(userId, externalId));
}

export async function listUserJobActivity(
  userId: number,
  externalId: string,
  limit = 50
) {
  if (shouldUsePersistentStore())
    return listPersistentJobActivity(userId, externalId, limit);
  return safeFallbackActivity(
    listFallbackJobActivity(userId, externalId, Math.min(limit, 100))
  );
}

export async function cancelUserJob(userId: number, externalId: string) {
  return shouldUsePersistentStore()
    ? cancelPersistentJob(userId, externalId)
    : cancelFallbackJob(userId, externalId);
}

export async function getAdminJobs(
  page = 0,
  pageSize = 20,
  status?: JobStatus
) {
  return shouldUsePersistentStore()
    ? listPersistentAdminJobs(page, pageSize, status)
    : (() => {
        const items = listAllFallbackJobs(100).filter(
          job => !status || job.status === status
        );
        const boundedSize = Math.min(pageSize, 50);
        const start = page * boundedSize;
        return {
          items: items.slice(start, start + boundedSize).map(safeFallbackJob),
          page,
          pageSize: boundedSize,
          total: items.length,
          totalPages: Math.ceil(items.length / boundedSize),
        };
      })();
}

export async function getAdminJobMetrics() {
  if (shouldUsePersistentStore()) return getPersistentJobMetrics();
  const metrics = {
    total: 0,
    queued: 0,
    processing: 0,
    retrying: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const job of listAllFallbackJobs(1000)) {
    metrics.total += 1;
    metrics[job.status.toLowerCase() as keyof typeof metrics] += 1;
  }
  return metrics;
}

export async function getAdminJobActivity(limit = 50) {
  if (shouldUsePersistentStore()) return listPersistentAdminJobActivity(limit);
  return safeFallbackActivity(listAllFallbackJobActivity(Math.min(limit, 100)));
}

export async function getAdminJobDetail(externalId: string) {
  if (shouldUsePersistentStore()) return getPersistentAdminJob(externalId);
  const job = getFallbackJobByExternalId(externalId);
  if (!job) throw new Error("Job not found");
  return safeFallbackJob(job);
}

type JobExecutionFailureInjector = (
  jobType: JobType,
  resourceId: string
) => Error | undefined;
let executionFailureInjector: JobExecutionFailureInjector | undefined;

export function setJobExecutionFailureInjectorForTests(
  injector?: JobExecutionFailureInjector
) {
  executionFailureInjector = injector;
}

async function executeJob(
  job: {
    id: string | number;
    externalId?: string;
    userId: number;
    jobType: JobType;
    payload: unknown;
    attemptCount: number;
    maxAttempts: number;
  },
  workerId: string
) {
  const externalId = job.externalId ?? job.id.toString();
  const parsedPayload = parseJobPayload(job.jobType, job.payload);
  const resourceId =
    "activationId" in parsedPayload
      ? parsedPayload.activationId
      : parsedPayload.inboxId;
  const persistent = shouldUsePersistentStore();
  const injectedFailure = executionFailureInjector?.(job.jobType, resourceId);
  if (injectedFailure) throw injectedFailure;
  const progress = async (value: number) => {
    if (persistent) {
      await updatePersistentJobProgress(
        Number(job.id),
        workerId,
        value,
        job.userId,
        externalId
      );
    } else {
      updateFallbackJobProgress(job as never, value, workerId);
    }
  };

  await progress(20);
  if (job.jobType === "MOCK_SMS_DELIVERY") {
    const result = persistent
      ? await completePersistentActivation({
          userId: job.userId,
          externalId: resourceId,
          sender: "SUBBY-DEMO",
          body: "Your simulated verification code is 482913.",
          receivedAt: new Date(),
        })
      : simulateSms(job.userId, resourceId);
    await progress(80);
    return { kind: "sms", resourceId, completed: Boolean(result) };
  }
  if (job.jobType === "DEMO_EMAIL_SIMULATION") {
    const result = persistent
      ? await (async () => {
          const inbox = await getPersistentInbox(job.userId, resourceId);
          return persistCompletedInboxMessage({
            userId: job.userId,
            externalId: resourceId,
            fromAddress: "hello@subby.demo",
            toAddress: inbox.address,
            subject: "Demo inbox message",
            body: "This simulated email confirms your Phase 1 inbox is working.",
            receivedAt: new Date(),
          });
        })()
      : simulateEmail(job.userId, resourceId);
    await progress(80);
    return { kind: "email", resourceId, completed: Boolean(result) };
  }
  if (job.jobType === "MAILBOX_EXPIRY") {
    const result = persistent
      ? await expirePersistentInbox(job.userId, resourceId)
      : expireInbox(job.userId, resourceId);
    await progress(80);
    return { kind: "mailbox_expiry", resourceId, completed: Boolean(result) };
  }
  const result = persistent
    ? await expirePersistentActivation(job.userId, resourceId)
    : expireActivation(job.userId, resourceId);
  await progress(80);
  return { kind: "activation_expiry", resourceId, completed: Boolean(result) };
}

let dispatchInFlight:
  | Promise<{
      claimed: number;
      completed: number;
      retrying: number;
      failed: number;
    }>
  | undefined;

export async function recoverStaleJobs(
  now = new Date(),
  timeoutMs = 5 * 60_000
) {
  return shouldUsePersistentStore()
    ? recoverStalePersistentJobs(now, timeoutMs)
    : recoverStaleFallbackJobs(now, timeoutMs).map(safeFallbackJob);
}

async function runDispatchQueuedJobs(limit = 10, now = new Date()) {
  const boundedLimit = Math.max(1, Math.min(limit, 25));
  const workerId = `worker-${process.pid}-${Date.now()}`;
  const summary = { claimed: 0, completed: 0, retrying: 0, failed: 0 };
  for (let index = 0; index < boundedLimit; index += 1) {
    const job = shouldUsePersistentStore()
      ? await claimNextPersistentJob(workerId, now)
      : claimFallbackJob(workerId, undefined, now);
    if (!job) break;
    const externalId = job.externalId ?? job.id.toString();
    summary.claimed += 1;
    const attemptCount = job.attemptCount;
    const maxAttempts = job.maxAttempts;
    try {
      const result = await executeJob(job, workerId);
      if (shouldUsePersistentStore()) {
        await completePersistentJob(
          Number(job.id),
          workerId,
          job.userId,
          externalId,
          result
        );
      } else {
        completeFallbackJob(job as never, result, workerId);
      }
      summary.completed += 1;
    } catch (error) {
      const safeError = safeJobError(error);
      const retry = isRetryableJobError(error) && attemptCount < maxAttempts;
      const retryAt = retry
        ? new Date(
            now.getTime() +
              Math.min(30_000, 1000 * 2 ** Math.max(0, attemptCount - 1))
          )
        : undefined;
      if (shouldUsePersistentStore()) {
        await settlePersistentJobFailure({
          jobId: Number(job.id),
          workerId,
          userId: job.userId,
          externalId,
          error: safeError,
          retryAt,
        });
      } else if (retry) {
        retryFallbackJob(job as never, safeError, retryAt!, workerId);
      } else {
        failFallbackJob(job as never, safeError, workerId);
      }
      if (retry) summary.retrying += 1;
      else summary.failed += 1;
    }
  }
  return summary;
}

export async function dispatchQueuedJobs(limit = 10, now = new Date()) {
  if (dispatchInFlight) return dispatchInFlight;
  dispatchInFlight = runDispatchQueuedJobs(limit, now).finally(() => {
    dispatchInFlight = undefined;
  });
  return dispatchInFlight;
}

export async function dispatchScheduledJobs(limit = 10) {
  await recoverStaleJobs();
  return dispatchQueuedJobs(limit);
}
