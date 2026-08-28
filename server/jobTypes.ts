import { z } from "zod";

export const JOB_TYPES = [
  "MOCK_SMS_DELIVERY",
  "DEMO_EMAIL_SIMULATION",
  "MAILBOX_EXPIRY",
  "ACTIVATION_EXPIRY",
  "SMS_STATUS_POLL",
] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "RETRYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

const resourceId = z.string().trim().min(1).max(120);

export const jobPayloadSchemas = {
  MOCK_SMS_DELIVERY: z.object({ activationId: resourceId }).strict(),
  DEMO_EMAIL_SIMULATION: z.object({ inboxId: resourceId }).strict(),
  MAILBOX_EXPIRY: z.object({ inboxId: resourceId }).strict(),
  ACTIVATION_EXPIRY: z.object({ activationId: resourceId }).strict(),
  SMS_STATUS_POLL: z.object({ activationId: resourceId }).strict(),
} satisfies Record<JobType, z.ZodTypeAny>;

export const jobTypeSchema = z.enum(JOB_TYPES);
export const jobStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "RETRYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const);

export function parseJobPayload<T extends JobType>(
  jobType: T,
  payload: unknown
): z.infer<(typeof jobPayloadSchemas)[T]> {
  return jobPayloadSchemas[jobType].parse(payload) as z.infer<
    (typeof jobPayloadSchemas)[T]
  >;
}

export function isRetryableJobError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /temporar|timeout|unavailable|connection|try again/i.test(
    error.message
  );
}

export function safeJobError(error: unknown) {
  const message = error instanceof Error ? error.message : "Job failed";
  const code = /not found/i.test(message)
    ? "NOT_FOUND"
    : /invalid|expired|cancel|insufficient/i.test(message)
      ? "DOMAIN_ERROR"
      : "JOB_ERROR";
  return { code, message: message.slice(0, 200) };
}

const unsafeMetadataKey =
  /(password|secret|token|credential|connection|string|body|message|stack|cookie|authorization|open.?id|api.?key|key)/i;

export function safeJobMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce<Record<string, unknown>>(
    (safe, [key, item]) => {
      if (unsafeMetadataKey.test(key)) return safe;
      if (
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        safe[key] = typeof item === "string" ? item.slice(0, 200) : item;
      }
      return safe;
    },
    {}
  );
}
