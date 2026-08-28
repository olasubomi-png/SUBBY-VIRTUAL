import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ONE_YEAR_MS } from "../shared/const";
import { sdk } from "./_core/sdk";
import {
  getBootstrapAdminEmail,
  hashPassword,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "./localAuth";
import { randomUUID } from "node:crypto";
import * as userDb from "./db";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import { LocalDemoMailProvider } from "./domain";
import {
  getConfiguredSmsProvider,
  resolveConfiguredSmsProvider,
} from "./providers";
import {
  cancelSmsOrder,
  createSmsOrder,
  getSmsOrder,
  listSmsOrders,
  pollSmsOrderCode,
} from "./smsOrders";
import { providerRegistry } from "./providers";
import {
  getCatalogCacheStatus,
  getCatalogSnapshot,
  toPublicCatalog,
} from "./smsCatalog";
import { formatPoints, minorToPoints } from "./subbyPoints";
import {
  getTopUpStatusForUser,
  initializePointTopUp,
  listSafePointPackages,
} from "./payments";
import { paymentProviderRegistry } from "./paymentProviders";
import type { DemoActivation, DemoInbox } from "./demoState";
import { createAuditEvent, type AuditEvent } from "./security";
import { checkDistributedRateLimit } from "./redis";
import {
  addDemoCredits,
  cancelSms,
  createDemoActivation,
  createDemoInbox,
  debitDemoCredits,
  expireInbox,
  getActivation,
  getDemoWallet,
  getInbox,
  listActivations,
  listAllActivations,
  listAllInboxes,
  listAllWallets,
  listInboxes,
} from "./demoState";
import { getDatabaseHealth } from "./db";
import { shouldUsePersistentStore } from "./persistenceMode";
import {
  cancelUserJob,
  createJob,
  dispatchQueuedJobs,
  queueEmailSimulationJob,
  queueSmsSimulationJob,
  getAdminJobActivity,
  getAdminJobDetail,
  getAdminJobMetrics,
  getAdminJobs,
  getUserJob,
  listUserJobActivity,
  listUserJobs,
} from "./jobs";
import { jobStatusSchema, jobTypeSchema, parseJobPayload } from "./jobTypes";
import {
  cancelPersistentActivation,
  expirePersistentInbox,
  getAdminMetrics,
  getPersistentActivation,
  getPersistentInbox,
  getPersistentWallet,
  getUserWalletSummary,
  creditPersistentWallet,
  debitPersistentWallet,
  listAuditLogs,
  listPersistentAdminActivations,
  listPersistentAdminInboxes,
  listPersistentWalletLedgers,
  searchAdminUsers,
  getAdminUserDetail,
  listUserLedger,
  persistActivation,
  persistInbox,
  listPersistentActivations,
  listPersistentInboxes,
  writeAuditLog,
  adminAdjustPoints,
  createPointTopUpIntent,
  listUserTopUpIntents,
} from "./persistence";
function sanitizeUser(user: import("../drizzle/schema").User | null) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

async function setSessionCookie(
  ctx: {
    req: Parameters<typeof getSessionCookieOptions>[0];
    res: { cookie: Function };
  },
  userId: number
) {
  const token = await sdk.createSessionToken(userId, {
    expiresInMs: ONE_YEAR_MS,
  });
  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: ONE_YEAR_MS,
  });
}

const mail = new LocalDemoMailProvider();
/** Resolved per call so SMS_PROVIDER env changes are honored without process restart in tests. */
function sms() {
  return getConfiguredSmsProvider();
}

function resolvedSms() {
  return resolveConfiguredSmsProvider();
}
const auditEvents: AuditEvent[] = [];

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => sanitizeUser(opts.ctx.user)),
    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(80),
          email: z.string().trim().email().max(320),
          password: z
            .string()
            .min(PASSWORD_MIN_LENGTH)
            .max(PASSWORD_MAX_LENGTH),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email);
        const allowed = await checkDistributedRateLimit(
          `auth:signup:${ctx.req.ip ?? "unknown"}:${email}`,
          5,
          900
        );
        if (!allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
        try {
          if (await userDb.getUserByEmail(email)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "An account with that email already exists",
            });
          }
          const user = await userDb.insertLocalUser({
            openId: `local_${randomUUID()}`,
            name: input.name.trim(),
            email,
            passwordHash: await hashPassword(input.password),
            role: getBootstrapAdminEmail() === email ? "admin" : "user",
          });
          await setSessionCookie(ctx, user.id);
          return sanitizeUser(user);
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Auth] Signup failed");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to create account",
          });
        }
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(320),
          password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email);
        const allowed = await checkDistributedRateLimit(
          `auth:login:${ctx.req.ip ?? "unknown"}:${email}`,
          10,
          900
        );
        if (!allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
        try {
          const user = await userDb.getUserByEmail(email);
          if (!user || user.status !== "active" || !user.passwordHash) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password",
            });
          }
          if (!(await verifyPassword(input.password, user.passwordHash))) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password",
            });
          }
          await userDb.upsertUser({
            openId: user.openId,
            lastSignedIn: new Date(),
          });
          await setSessionCookie(ctx, user.id);
          return sanitizeUser(user);
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Auth] Login failed");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to sign in",
          });
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const wallet = shouldUsePersistentStore()
        ? await getUserWalletSummary(ctx.user.id)
        : {
            currency: "NGN" as const,
            balance: getDemoWallet(ctx.user.id).balanceMinor,
            entries: getDemoWallet(ctx.user.id).ledger.length,
          };
      const persistent = shouldUsePersistentStore();
      const activations = persistent
        ? await listPersistentActivations(ctx.user.id)
        : listActivations(ctx.user.id);
      const inboxes = persistent
        ? await listPersistentInboxes(ctx.user.id)
        : listInboxes(ctx.user.id);
      const completed = activations.filter(
        item =>
          item.status === "COMPLETED" ||
          item.status === "completed" ||
          item.status === "code_received"
      ).length;
      return {
        user: ctx.user.name ?? "Customer",
        balance: { NGN: wallet.balance, USD: 0 },
        activeRequests:
          activations.filter(
            item =>
              item.status === "ACTIVE" ||
              item.status === "active" ||
              item.status === "pending" ||
              item.status === "allocating" ||
              item.status === "WAITING"
          ).length +
          inboxes.filter(item => item.status === "ACTIVE").length,
        successRate: activations.length
          ? Number(((completed / activations.length) * 100).toFixed(1))
          : 0,
        providerMode: "mock" as const,
      };
    }),
    wallet: protectedProcedure.query(async ({ ctx }) => {
      const wallet = shouldUsePersistentStore()
        ? await getPersistentWallet(ctx.user.id)
        : getDemoWallet(ctx.user.id);
      const points = minorToPoints(wallet.balanceMinor);
      return {
        /** @deprecated use points — retained for compatibility */
        balanceMinor: wallet.balanceMinor,
        creditsMinor: wallet.creditsMinor,
        spentMinor: wallet.spentMinor,
        points,
        pointsLabel: formatPoints(points),
        unit: "SUBBY Points",
        ledger: (wallet.ledger as Array<Record<string, unknown>>).map(entry => ({
          ...entry,
          points: minorToPoints(Number(entry.amountMinor ?? 0)),
        })),
      };
    }),
    walletTransactions: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).default(50),
            offset: z.number().int().min(0).max(10000).default(0),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 50;
        const offset = input?.offset ?? 0;
        if (shouldUsePersistentStore()) {
          const rows = await listUserLedger(ctx.user.id, limit, offset);
          return {
            items: rows.map(row => ({
              id: row.id,
              type: row.type,
              points: minorToPoints(row.amountMinor),
              amountMinor: row.amountMinor,
              reason: row.reason,
              reference: row.reference,
              createdAt: row.createdAt.toISOString(),
            })),
            limit,
            offset,
          };
        }
        const wallet = getDemoWallet(ctx.user.id);
        const slice = wallet.ledger.slice(offset, offset + limit);
        return {
          items: slice.map(entry => ({
            id: entry.id,
            type: entry.type,
            points: minorToPoints(entry.amountMinor),
            amountMinor: entry.amountMinor,
            reason: entry.reason,
            reference: entry.reference,
            createdAt: entry.createdAt,
          })),
          limit,
          offset,
        };
      }),
    pointPackages: protectedProcedure.query(() => listSafePointPackages()),
    initializeTopUp: protectedProcedure
      .input(
        z.object({
          packageId: z.string().min(1).max(64),
          idempotencyKey: z.string().uuid(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const email =
          (ctx.user as { email?: string | null }).email?.trim() ||
          `user${ctx.user.id}@subby.local`;
        try {
          return await initializePointTopUp({
            userId: ctx.user.id,
            email,
            packageId: input.packageId,
            idempotencyKey: input.idempotencyKey,
          });
        } catch (error) {
          if (error instanceof Error && error.message === "Unknown points package") {
            throw error;
          }
          throw new Error("Unable to initialize top-up");
        }
      }),
    topUpStatus: protectedProcedure
      .input(z.object({ topUpId: z.string().min(1).max(160) }))
      .query(async ({ ctx, input }) => {
        try {
          return await getTopUpStatusForUser({
            userId: ctx.user.id,
            topUpId: input.topUpId,
          });
        } catch {
          throw new Error("Top-up not found");
        }
      }),
    topUpIntents: protectedProcedure.query(async ({ ctx }) => {
      if (shouldUsePersistentStore()) {
        const rows = await listUserTopUpIntents(ctx.user.id);
        return rows.map(row => ({
          id: row.externalId,
          points: row.points,
          status: row.status,
          currency: row.currency,
          amountMinor: row.amountMinor,
          createdAt: row.createdAt.toISOString(),
          completedAt: row.completedAt?.toISOString(),
        }));
      }
      return [];
    }),
    addDemoCredits: protectedProcedure
      .input(
        z.object({
          amountMinor: z.number().int().min(100).max(100000),
          requestId: z.string().uuid(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const reference = `demo-credit-${ctx.user.id}-${input.requestId}`;
        const wallet = shouldUsePersistentStore()
          ? await creditPersistentWallet(
              ctx.user.id,
              input.amountMinor,
              reference
            )
          : addDemoCredits(ctx.user.id, input.amountMinor, reference);
        return {
          balanceMinor: wallet.balanceMinor,
          creditsMinor: wallet.creditsMinor,
          spentMinor: wallet.spentMinor,
        };
      }),
    smsRequests: protectedProcedure.query(async ({ ctx }) =>
      listSmsOrders(ctx.user.id)
    ),
    smsRequestDetail: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .query(async ({ input, ctx }) => getSmsOrder(ctx.user.id, input.id)),
    simulateSms: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) =>
        queueSmsSimulationJob(ctx.user.id, input.id)
      ),
    cancelSms: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await cancelSmsOrder(ctx.user.id, input.id, sms());
        } catch (error) {
          if (error instanceof Error) {
            const safe = new Set([
              "Activation not found",
              "Activation cannot be cancelled",
              "SMS order is terminal and cannot be cancelled",
              "Invalid SMS order transition: completed → cancelled",
              "Invalid SMS order transition: cancelled → cancelled",
              "Invalid SMS order transition: expired → cancelled",
              "Invalid SMS order transition: failed → cancelled",
            ]);
            // Allow lifecycle transition errors through as safe messages
            if (safe.has(error.message) || error.message.startsWith("Invalid SMS order transition"))
              throw error;
          }
          throw new Error("Unable to cancel SMS order");
        }
      }),
    pollSms: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await pollSmsOrderCode(ctx.user.id, input.id, sms());
        } catch (error) {
          if (error instanceof Error) {
            if (
              error.message === "Activation not found" ||
              error.message === "SMS order is not awaiting a verification code" ||
              error.message === "SMS order has no provider reference" ||
              error.message.startsWith("Invalid SMS order transition") ||
              error.message.startsWith("SMS order is terminal")
            ) {
              throw error;
            }
          }
          throw new Error("Unable to poll SMS order");
        }
      }),
    mailInboxes: protectedProcedure.query(async ({ ctx }) =>
      shouldUsePersistentStore()
        ? listPersistentInboxes(ctx.user.id)
        : listInboxes(ctx.user.id)
    ),
    mailInboxDetail: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .query(
        async ({ input, ctx }): Promise<DemoInbox> =>
          shouldUsePersistentStore()
            ? ((await getPersistentInbox(ctx.user.id, input.id)) as DemoInbox)
            : getInbox(ctx.user.id, input.id)
      ),
    simulateEmail: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) =>
        queueEmailSimulationJob(ctx.user.id, input.id)
      ),
    expireInbox: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        if (shouldUsePersistentStore())
          return expirePersistentInbox(ctx.user.id, input.id);
        return expireInbox(ctx.user.id, input.id);
      }),
    smsOptions: protectedProcedure.query(async () => {
      const provider = sms();
      const snapshot = await getCatalogSnapshot(provider);
      const publicEntries = toPublicCatalog(snapshot.entries);
      const countriesMap = new Map<string, string>();
      const servicesMap = new Map<string, string>();
      const pricing: Array<{
        serviceId: string;
        countryCode: string;
        amount: number;
        currency: string;
        available: boolean;
      }> = [];
      for (const entry of publicEntries) {
        countriesMap.set(entry.countryCode, entry.countryName);
        servicesMap.set(entry.serviceId, entry.serviceName);
        pricing.push({
          serviceId: entry.serviceId,
          countryCode: entry.countryCode,
          amount: entry.retailPriceMinor,
          currency: entry.currency,
          available: entry.available,
        });
      }
      return {
        countries: [...countriesMap.entries()].map(([code, name]) => ({
          code,
          name,
        })),
        services: [...servicesMap.entries()].map(([id, name]) => ({
          id,
          name,
        })),
        pricing,
        catalogVersion: snapshot.version,
        // provider cost intentionally omitted
      };
    }),
    createSmsRequest: protectedProcedure
      .input(
        z.object({
          country: z.string().min(2).max(3),
          serviceId: z.string().min(2).max(40),
          idempotencyKey: z.string().uuid(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (
          !(await checkDistributedRateLimit(`subby:sms:${ctx.user.id}`, 5, 60))
        )
          throw new Error("Request rate limit exceeded");
        try {
          const { provider, providerType } = resolvedSms();
          const result = await createSmsOrder({
            userId: ctx.user.id,
            country: input.country,
            serviceId: input.serviceId,
            idempotencyKey: input.idempotencyKey,
            provider,
            providerType,
          });
          // Bounded server-side OTP polling (max 20 attempts via job dispatcher)
          if (!result.reused && result.status === "active" && result.id) {
            try {
              await queueSmsStatusPollJob(ctx.user.id, result.id);
            } catch {
              // non-fatal — client can still call pollSms
            }
          }
          if (shouldUsePersistentStore() && !result.reused) {
            await writeAuditLog({
              actorUserId: ctx.user.id,
              action: "sms.request.created",
              targetType: "smsActivation",
              targetId: result.id,
              metadata: {
                mode: providerType,
                country: input.country,
                serviceId: input.serviceId,
              },
            });
          }
          auditEvents.push(
            createAuditEvent({
              actorId: ctx.user.id,
              action: "sms.request.created",
              targetType: "smsActivation",
              targetId: result.id,
              metadata: {
                mode: "mock",
                country: input.country,
                serviceId: input.serviceId,
              },
            })
          );
          return result;
        } catch (error) {
          if (error instanceof Error) {
            const safe = new Set([
              "Unknown SMS country",
              "Unknown SMS service",
              "Insufficient balance",
              "Idempotency key is required",
              "Unable to allocate SMS number",
              "Invalid currency",
              "Request rate limit exceeded",
            ]);
            if (safe.has(error.message)) throw error;
          }
          throw new Error("Unable to create SMS order");
        }
      }),
    createMailInbox: protectedProcedure
      .input(z.object({ label: z.string().trim().min(2).max(40) }))
      .mutation(async ({ input, ctx }) => {
        if (
          !(await checkDistributedRateLimit(`subby:mail:${ctx.user.id}`, 5, 60))
        )
          throw new Error("Request rate limit exceeded");
        const inbox = await mail.createTemporaryInbox({
          ...input,
          userId: ctx.user.id,
        });
        const demoInbox = createDemoInbox(ctx.user.id, input.label);
        if (shouldUsePersistentStore()) {
          await persistInbox({
            userId: ctx.user.id,
            externalId: demoInbox.id,
            address: inbox.address,
            domain: "subby.demo",
            status: "ACTIVE",
            expiresAt: new Date(inbox.expiresAt),
          });
          await writeAuditLog({
            actorUserId: ctx.user.id,
            action: "mail.inbox.created",
            targetType: "temporaryInbox",
            targetId: inbox.id,
            metadata: { mode: "mock", label: input.label },
          });
        }
        auditEvents.push(
          createAuditEvent({
            actorId: ctx.user.id,
            action: "mail.inbox.created",
            targetType: "temporaryInbox",
            targetId: inbox.id,
            metadata: { mode: "mock", label: input.label },
          })
        );
        return demoInbox;
      }),
    ledger: protectedProcedure.query(async ({ ctx }) => {
      if (shouldUsePersistentStore()) {
        const wallet = await getUserWalletSummary(ctx.user.id);
        return {
          currency: wallet.currency,
          balance: wallet.balance,
          entries: await listUserLedger(ctx.user.id),
        };
      }
      return {
        currency: "NGN" as const,
        balance: 0,
        entries: [] as Array<{
          id: string;
          type: string;
          amountMinor: number;
          reason: string;
          createdAt: string;
        }>,
      };
    }),
    demoLedgerDisabled: protectedProcedure.query(() => ({
      disabled: true as const,
    })),
    legacyLedgerRemoved: protectedProcedure.query(() => ({
      currency: "NGN" as const,
      balance: 0,
      entries: [] as const,
    })),
    jobs: router({
      list: protectedProcedure
        .input(
          z.object({
            page: z.number().int().min(0).max(10000).default(0),
            pageSize: z.number().int().min(1).max(50).default(20),
          })
        )
        .query(({ input, ctx }) =>
          listUserJobs(ctx.user.id, input.page, input.pageSize)
        ),
      detail: protectedProcedure
        .input(z.object({ id: z.string().trim().min(1).max(120) }))
        .query(({ input, ctx }) => getUserJob(ctx.user.id, input.id)),
      activity: protectedProcedure
        .input(
          z.object({
            id: z.string().trim().min(1).max(120),
            limit: z.number().int().min(1).max(100).default(50),
          })
        )
        .query(({ input, ctx }) =>
          listUserJobActivity(ctx.user.id, input.id, input.limit)
        ),
      create: protectedProcedure
        .input(
          z.object({
            requestId: z.string().uuid(),
            jobType: jobTypeSchema,
            payload: z.record(z.string(), z.string()),
            maxAttempts: z.number().int().min(1).max(5).default(3),
          })
        )
        .mutation(async ({ input, ctx }) => {
          if (
            !(await checkDistributedRateLimit(
              `subby:jobs:${ctx.user.id}`,
              30,
              60
            ))
          )
            throw new Error("Job creation rate limit exceeded");
          parseJobPayload(input.jobType, input.payload);
          const resourceId =
            "activationId" in input.payload
              ? input.payload.activationId
              : input.payload.inboxId;
          if (
            input.jobType === "MOCK_SMS_DELIVERY" ||
            input.jobType === "ACTIVATION_EXPIRY"
          ) {
            if (shouldUsePersistentStore())
              await getPersistentActivation(ctx.user.id, resourceId);
            else getActivation(ctx.user.id, resourceId);
          } else {
            if (shouldUsePersistentStore())
              await getPersistentInbox(ctx.user.id, resourceId);
            else getInbox(ctx.user.id, resourceId);
          }
          return createJob({
            externalId: `job-${ctx.user.id}-${input.requestId}`,
            userId: ctx.user.id,
            jobType: input.jobType,
            payload: input.payload,
            maxAttempts: input.maxAttempts,
          });
        }),
      cancel: protectedProcedure
        .input(z.object({ id: z.string().trim().min(1).max(120) }))
        .mutation(async ({ input, ctx }) => {
          if (
            !(await checkDistributedRateLimit(
              `subby:job-cancel:${ctx.user.id}`,
              30,
              60
            ))
          )
            throw new Error("Job cancellation rate limit exceeded");
          return cancelUserJob(ctx.user.id, input.id);
        }),
    }),
    /* legacy example intentionally removed */
    /* ledger: protectedProcedure.query(() => ({
      currency: "NGN" as const,
      balance: 0,
      entries: [
        {
          id: "led_001",
          type: "CREDIT",
          amount: 8000,
          reason: "Demo wallet top-up",
          createdAt: "Today, 09:42",
        },
        {
          id: "led_002",
          type: "DEBIT",
          amount: 150,
          reason: "Account verification",
          createdAt: "Today, 09:18",
        },
        {
          id: "led_003",
          type: "DEBIT",
          amount: 80,
          reason: "Sandbox testing",
          createdAt: "Yesterday, 16:04",
        },
      ],
    })), */
  }),
  admin: router({
    users: adminProcedure
      .input(
        z.object({
          query: z.string().trim().max(120).default(""),
          page: z.number().int().min(0).max(10000).default(0),
          pageSize: z.number().int().min(1).max(50).default(20),
        })
      )
      .query(async ({ input, ctx }) => {
        if (
          !(await checkDistributedRateLimit(
            `subby:admin-users:${ctx.user.id}`,
            60,
            60
          ))
        )
          throw new Error("Admin user search rate limit exceeded");
        if (!shouldUsePersistentStore())
          return {
            items: [],
            page: input.page,
            pageSize: input.pageSize,
            total: 0,
            totalPages: 0,
          };
        return searchAdminUsers(input.query, input.page, input.pageSize);
      }),
    userDetail: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        if (
          !(await checkDistributedRateLimit(
            `subby:admin-user-detail:${ctx.user.id}`,
            60,
            60
          ))
        )
          throw new Error("Admin user detail rate limit exceeded");
        if (!shouldUsePersistentStore())
          throw new Error("Persistent user management requires PostgreSQL");
        return getAdminUserDetail(input.userId);
      }),
    jobs: router({
      metrics: adminProcedure.query(() => getAdminJobMetrics()),
      list: adminProcedure
        .input(
          z.object({
            page: z.number().int().min(0).max(10000).default(0),
            pageSize: z.number().int().min(1).max(50).default(20),
            status: jobStatusSchema.optional(),
          })
        )
        .query(({ input }) =>
          getAdminJobs(input.page, input.pageSize, input.status)
        ),
      activity: adminProcedure
        .input(
          z.object({ limit: z.number().int().min(1).max(100).default(50) })
        )
        .query(({ input }) => getAdminJobActivity(input.limit)),
      detail: adminProcedure
        .input(z.object({ id: z.string().trim().min(1).max(120) }))
        .query(({ input }) => getAdminJobDetail(input.id)),
      dispatch: adminProcedure
        .input(z.object({ limit: z.number().int().min(1).max(25).default(10) }))
        .mutation(({ input }) => dispatchQueuedJobs(input.limit)),
    }),
    adjustPoints: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          points: z.number().int().positive().max(10_000_000),
          direction: z.enum(["credit", "debit"]),
          reason: z.string().trim().min(3).max(120),
          idempotencyKey: z.string().uuid(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!shouldUsePersistentStore()) {
          // Demo mode: use demo credits path for credit only
          if (input.direction === "credit") {
            const { addDemoCredits } = await import("./demoState");
            const wallet = addDemoCredits(
              input.userId,
              input.points,
              `admin-adj-${input.idempotencyKey}`
            );
            await writeAuditLog({
              actorUserId: ctx.user.id,
              action: "points.admin_adjustment",
              targetType: "user",
              targetId: String(input.userId),
              metadata: {
                direction: input.direction,
                points: input.points,
                reason: input.reason,
              },
            }).catch(() => undefined);
            return {
              points: minorToPoints(wallet.balanceMinor),
              direction: input.direction,
            };
          }
          throw new Error("Admin debit requires PostgreSQL wallet");
        }
        const wallet = await adminAdjustPoints({
          userId: input.userId,
          points: input.points,
          direction: input.direction,
          reason: input.reason,
          reference: `admin-adj-${input.idempotencyKey}`,
          actorUserId: ctx.user.id,
        });
        await writeAuditLog({
          actorUserId: ctx.user.id,
          action: "points.admin_adjustment",
          targetType: "user",
          targetId: String(input.userId),
          metadata: {
            direction: input.direction,
            points: input.points,
            reason: input.reason,
          },
        });
        return {
          points: minorToPoints(wallet.balanceMinor),
          direction: input.direction,
        };
      }),
    paymentHealth: adminProcedure.query(async () => paymentProviderRegistry.health()),
    databaseHealth: adminProcedure.query(() => getDatabaseHealth()),
    providerHealth: adminProcedure.query(async () => {
      const health = await providerRegistry.health();
      let catalog;
      try {
        catalog = getCatalogCacheStatus();
      } catch {
        catalog = { mode: "invalid", cached: false };
      }
      return {
        sms: {
          ok: health.sms.ok,
          detail: health.sms.detail,
          balanceMajor:
            "balanceMajor" in health.sms
              ? (health.sms as { balanceMajor?: number }).balanceMajor
              : undefined,
        },
        mail: { ok: health.mail.ok, detail: health.mail.detail },
        config: health.config,
        catalog,
      };
    }),
    overview: adminProcedure.query(async () => {
      const persistent = shouldUsePersistentStore()
        ? await getAdminMetrics()
        : null;
      return {
        users: persistent?.users ?? 0,
        requestsToday: persistent?.activations ?? 0,
        walletVolume: persistent?.walletVolumeMinor ?? 0,
        activeProviders: persistent?.providers ?? 0,
        inboxes: persistent?.inboxes ?? 0,
        recentAudit: persistent
          ? [
              `${persistent.providers} registered providers`,
              `${persistent.inboxes} temporary inbox records`,
              `${persistent.audits} persisted audit events`,
            ]
          : ["PostgreSQL metrics unavailable until DATABASE_URL is configured"],
        auditEvents: persistent
          ? await listAuditLogs(20, 0)
          : auditEvents.slice(-20).reverse(),
      };
    }),
    activations: adminProcedure.query(async () => {
      if (shouldUsePersistentStore()) return listPersistentAdminActivations();
      return listAllActivations().map(({ message, ...safe }) => ({
        ...safe,
        hasMessage: Boolean(message),
      }));
    }),
    inboxes: adminProcedure.query(async () => {
      if (shouldUsePersistentStore()) return listPersistentAdminInboxes();
      return listAllInboxes().map(({ messages, ...safe }) => ({
        ...safe,
        messageCount: messages.length,
      }));
    }),
    walletLedger: adminProcedure.query(async () =>
      shouldUsePersistentStore()
        ? listPersistentWalletLedgers()
        : listAllWallets()
    ),
    auditHistory: adminProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
      )
      .query(async ({ input }) =>
        shouldUsePersistentStore()
          ? listAuditLogs(input.limit, input.offset)
          : auditEvents.slice(input.offset, input.offset + input.limit)
      ),
  }),
});

export type AppRouter = typeof appRouter;
