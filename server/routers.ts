import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import { LocalDemoMailProvider, MockSMSProvider } from "./domain";
import { createAuditEvent, type AuditEvent } from "./security";
import { checkDistributedRateLimit } from "./redis";
import {
  addDemoCredits,
  createDemoActivation,
  createDemoInbox,
  debitDemoCredits,
  getActivation,
  getDemoWallet,
  getInbox,
  listActivations,
  listInboxes,
  simulateEmail,
  simulateSms,
} from "./demoState";
import {
  getAdminMetrics,
  getUserWalletSummary,
  listAuditLogs,
  listUserLedger,
  persistActivation,
  persistInbox,
  writeAuditLog,
} from "./persistence";
const sms = new MockSMSProvider();
const mail = new LocalDemoMailProvider();
const auditEvents: AuditEvent[] = [];

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const wallet = process.env.DATABASE_URL?.startsWith("postgres")
        ? await getUserWalletSummary(ctx.user.id)
        : {
            currency: "NGN" as const,
            balance: getDemoWallet(ctx.user.id).balanceMinor,
            entries: getDemoWallet(ctx.user.id).ledger.length,
          };
      const activations = listActivations(ctx.user.id);
      const inboxes = listInboxes(ctx.user.id);
      const completed = activations.filter(
        item => item.status === "COMPLETED"
      ).length;
      return {
        user: ctx.user.name ?? "Customer",
        balance: { NGN: wallet.balance, USD: 0 },
        activeRequests:
          activations.filter(item => item.status === "ACTIVE").length +
          inboxes.filter(item => item.status === "ACTIVE").length,
        successRate: activations.length
          ? Number(((completed / activations.length) * 100).toFixed(1))
          : 0,
        providerMode: "mock" as const,
      };
    }),
    wallet: protectedProcedure.query(({ ctx }) => {
      const wallet = getDemoWallet(ctx.user.id);
      return {
        balanceMinor: wallet.balanceMinor,
        creditsMinor: wallet.creditsMinor,
        spentMinor: wallet.spentMinor,
        ledger: wallet.ledger,
      };
    }),
    addDemoCredits: protectedProcedure
      .input(
        z.object({
          amountMinor: z.number().int().min(100).max(100000),
          requestId: z.string().uuid(),
        })
      )
      .mutation(({ input, ctx }) => {
        const wallet = addDemoCredits(
          ctx.user.id,
          input.amountMinor,
          `demo-credit-${ctx.user.id}-${input.requestId}`
        );
        return {
          balanceMinor: wallet.balanceMinor,
          creditsMinor: wallet.creditsMinor,
          spentMinor: wallet.spentMinor,
        };
      }),
    smsRequests: protectedProcedure.query(({ ctx }) =>
      listActivations(ctx.user.id)
    ),
    simulateSms: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(({ input, ctx }) => simulateSms(ctx.user.id, input.id)),
    mailInboxes: protectedProcedure.query(({ ctx }) =>
      listInboxes(ctx.user.id)
    ),
    simulateEmail: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(({ input, ctx }) => simulateEmail(ctx.user.id, input.id)),
    smsOptions: protectedProcedure.query(async () => ({
      countries: await sms.getCountries(),
      services: await sms.getServices(),
      pricing: await sms.getPricing(),
    })),
    createSmsRequest: protectedProcedure
      .input(
        z.object({
          country: z.string().min(2).max(3),
          serviceId: z.string().min(2).max(40),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (
          !(await checkDistributedRateLimit(`subby:sms:${ctx.user.id}`, 5, 60))
        )
          throw new Error("Request rate limit exceeded");
        const pricing = await sms.getPricing();
        const quote = pricing.find(item => item.serviceId === input.serviceId);
        if (!quote) throw new Error("Unknown SMS service");
        const wallet = debitDemoCredits(
          ctx.user.id,
          quote.amount,
          `${quote.serviceId} demo activation`,
          `sms-${ctx.user.id}-${Date.now()}`
        );
        const activation = await sms.buyActivation({
          ...input,
          userId: ctx.user.id,
        });
        const demoActivation = createDemoActivation({
          userId: ctx.user.id,
          country: input.country,
          serviceId: input.serviceId,
          priceMinor: quote.amount,
        });
        if (process.env.DATABASE_URL?.startsWith("postgres")) {
          await persistActivation({
            userId: ctx.user.id,
            providerType: "MOCK",
            countryCode: input.country,
            serviceId: input.serviceId,
            phoneNumber: activation.phoneNumber,
            status: "WAITING",
            quotedPriceMinor: quote.amount,
            currency: "NGN",
          });
          await writeAuditLog({
            actorUserId: ctx.user.id,
            action: "sms.request.created",
            targetType: "smsActivation",
            targetId: activation.id,
            metadata: {
              mode: "mock",
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
            targetId: activation.id,
            metadata: {
              mode: "mock",
              country: input.country,
              serviceId: input.serviceId,
            },
          })
        );
        return {
          ...demoActivation,
          providerActivationId: activation.id,
          walletBalanceMinor: wallet.balanceMinor,
          audit: "Mock request created; no external provider contacted.",
        };
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
        if (process.env.DATABASE_URL?.startsWith("postgres")) {
          await persistInbox({
            userId: ctx.user.id,
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
      if (process.env.DATABASE_URL?.startsWith("postgres")) {
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
    overview: adminProcedure.query(async () => {
      const persistent = process.env.DATABASE_URL?.startsWith("postgres")
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
    auditHistory: adminProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
      )
      .query(async ({ input }) =>
        process.env.DATABASE_URL?.startsWith("postgres")
          ? listAuditLogs(input.limit, input.offset)
          : auditEvents.slice(input.offset, input.offset + input.limit)
      ),
  }),
});

export type AppRouter = typeof appRouter;
