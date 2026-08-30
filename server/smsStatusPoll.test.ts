import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchQueuedJobs, queueSmsStatusPollJob } from "./jobs";
import { JOB_TYPES } from "./jobTypes";
import {
  createSmsOrder,
  seedDemoCreditsForTests,
} from "./smsOrders";
import { MockSMSProvider } from "./domain";
import { resetDemoState } from "./demoState";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  resetDemoState();
});
afterEach(() => vi.unstubAllEnvs());

describe("SMS status poll job", () => {
  it("includes SMS_STATUS_POLL in job types", () => {
    expect(JOB_TYPES).toContain("SMS_STATUS_POLL");
  });

  it("queues a bounded status poll job", async () => {
    seedDemoCreditsForTests(200, 100_000, "seed-200");
    const order = await createSmsOrder({
      userId: 200,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      provider: new MockSMSProvider(),
    });
    const job = await queueSmsStatusPollJob(200, order.id);
    expect(job.jobType).toBe("SMS_STATUS_POLL");
    expect(job.maxAttempts).toBeGreaterThanOrEqual(5);
  });

  it("poll job completes or retries without throwing uncaught", async () => {
    seedDemoCreditsForTests(201, 100_000, "seed-201");
    const order = await createSmsOrder({
      userId: 201,
      country: "NG",
      serviceId: "whatsapp",
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      provider: new MockSMSProvider(),
    });
    await queueSmsStatusPollJob(201, order.id);
    const summary = await dispatchQueuedJobs(5);
    expect(summary.claimed).toBeGreaterThanOrEqual(1);
  });
});
