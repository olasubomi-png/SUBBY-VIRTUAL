import type { JobStatus, JobType } from "./jobTypes";

export type FallbackJob = {
  id: string;
  externalId: string;
  userId: number;
  jobType: JobType;
  status: JobStatus;
  payload: Record<string, string>;
  result?: Record<string, string | number | boolean>;
  error?: { code: string; message: string };
  attemptCount: number;
  maxAttempts: number;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  updatedAt: string;
  nextRunAt: string;
  lockedBy?: string;
};

export type FallbackJobActivity = {
  id: string;
  userId: number;
  jobId: string;
  eventType: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
};

const jobs = new Map<string, FallbackJob>();
const activities = new Map<string, FallbackJobActivity[]>();
let sequence = 0;

const nowIso = () => new Date().toISOString();

export function createFallbackJob(input: {
  externalId: string;
  userId: number;
  jobType: JobType;
  payload: Record<string, string>;
  maxAttempts: number;
}) {
  const now = nowIso();
  const job: FallbackJob = {
    id: input.externalId,
    externalId: input.externalId,
    userId: input.userId,
    jobType: input.jobType,
    status: "QUEUED",
    payload: input.payload,
    attemptCount: 0,
    maxAttempts: input.maxAttempts,
    progress: 0,
    createdAt: now,
    updatedAt: now,
    nextRunAt: now,
  };
  jobs.set(job.externalId, job);
  appendFallbackActivity(job, "created", { status: job.status });
  appendFallbackActivity(job, "queued", { status: job.status });
  return job;
}

export function getFallbackJob(userId: number, externalId: string) {
  const job = jobs.get(externalId);
  if (!job || job.userId !== userId) throw new Error("Job not found");
  return job;
}

export function listFallbackJobs(
  userId: number,
  page: number,
  pageSize: number
) {
  const items = Array.from(jobs.values())
    .filter(job => job.userId === userId)
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
    );
  const start = page * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

export function listFallbackJobActivity(
  userId: number,
  externalId: string,
  limit: number
) {
  getFallbackJob(userId, externalId);
  return (activities.get(externalId) ?? []).slice(-limit).reverse();
}

export function listAllFallbackJobs(limit: number) {
  return Array.from(jobs.values())
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
    )
    .slice(0, limit);
}

export function listAllFallbackJobActivity(limit: number) {
  return Array.from(activities.values())
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getFallbackJobByExternalId(externalId: string) {
  return jobs.get(externalId);
}

export function cancelFallbackJob(userId: number, externalId: string) {
  const job = getFallbackJob(userId, externalId);
  if (job.status !== "QUEUED" && job.status !== "RETRYING")
    throw new Error("Job cannot be cancelled in its current state");
  const now = nowIso();
  job.status = "CANCELLED";
  job.cancelledAt = now;
  job.updatedAt = now;
  job.lockedBy = undefined;
  appendFallbackActivity(job, "cancelled", { status: job.status });
  return job;
}

export function claimFallbackJob(
  workerId: string,
  ownerUserId?: number,
  now = new Date()
) {
  const candidate = Array.from(jobs.values())
    .filter(
      job =>
        (!ownerUserId || job.userId === ownerUserId) &&
        (job.status === "QUEUED" || job.status === "RETRYING") &&
        new Date(job.nextRunAt).getTime() <= now.getTime()
    )
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
    )[0];
  if (!candidate) return undefined;
  if (candidate.lockedBy) return undefined;
  candidate.lockedBy = workerId;
  candidate.status = "PROCESSING";
  candidate.attemptCount += 1;
  candidate.startedAt ??= now.toISOString();
  candidate.updatedAt = now.toISOString();
  appendFallbackActivity(candidate, "processing_started", {
    status: candidate.status,
    attempt: candidate.attemptCount,
  });
  return candidate;
}

export function updateFallbackJobProgress(
  job: FallbackJob,
  progress: number,
  workerId: string
) {
  if (job.lockedBy !== workerId || job.status !== "PROCESSING")
    throw new Error("Job claim is no longer active");
  job.progress = Math.max(0, Math.min(99, progress));
  job.updatedAt = nowIso();
  appendFallbackActivity(job, "progress_changed", { progress: job.progress });
}

export function completeFallbackJob(
  job: FallbackJob,
  result: Record<string, string | number | boolean>,
  workerId: string
) {
  if (job.lockedBy !== workerId || job.status !== "PROCESSING")
    throw new Error("Job claim is no longer active");
  const now = nowIso();
  job.status = "COMPLETED";
  job.progress = 100;
  job.result = result;
  job.completedAt = now;
  job.updatedAt = now;
  job.lockedBy = undefined;
  appendFallbackActivity(job, "completed", { status: job.status });
  return job;
}

export function retryFallbackJob(
  job: FallbackJob,
  error: { code: string; message: string },
  nextRunAt: Date,
  workerId: string
) {
  if (job.lockedBy !== workerId || job.status !== "PROCESSING")
    throw new Error("Job claim is no longer active");
  job.status = "RETRYING";
  job.error = error;
  job.nextRunAt = nextRunAt.toISOString();
  job.updatedAt = nowIso();
  job.lockedBy = undefined;
  appendFallbackActivity(job, "retry_scheduled", {
    status: job.status,
    attempt: job.attemptCount,
  });
  return job;
}

export function failFallbackJob(
  job: FallbackJob,
  error: { code: string; message: string },
  workerId: string
) {
  if (job.lockedBy !== workerId || job.status !== "PROCESSING")
    throw new Error("Job claim is no longer active");
  job.status = "FAILED";
  job.error = error;
  job.updatedAt = nowIso();
  job.lockedBy = undefined;
  appendFallbackActivity(job, "failed", { status: job.status });
  return job;
}

export function appendFallbackActivity(
  job: FallbackJob,
  eventType: string,
  metadata: Record<string, string | number | boolean>
) {
  const event: FallbackJobActivity = {
    id: `fallback-job-event-${++sequence}`,
    userId: job.userId,
    jobId: job.externalId,
    eventType,
    metadata,
    createdAt: nowIso(),
  };
  const existing = activities.get(job.externalId) ?? [];
  existing.push(event);
  activities.set(job.externalId, existing.slice(-100));
  return event;
}

export function resetFallbackJobs() {
  jobs.clear();
  activities.clear();
  sequence = 0;
}
