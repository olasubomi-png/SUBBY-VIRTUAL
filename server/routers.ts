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
  simulateEmail,
  simulateSms,
} from "./demoState";
import { getDatabaseHealth } from "./db";
import { shouldUsePersistentStore } from "./persistenceMode";
import {
  cancelPersistentActivation,
  completePersistentActivation,
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
  listUserLedger,
  persistActivation,
  persistCompletedInboxMessage,
  persistInbox,
  listPersistentActivations,
  listPersistentInboxes,
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
    wallet: protectedProcedure.query(async ({ ctx }) => {
      const wallet = shouldUsePersistentStore()
        ? await getPersistentWallet(ctx.user.id)
        : getDemoWallet(ctx.user.id);
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
      shouldUsePersistentStore()
        ? listPersistentActivations(ctx.user.id)
        : listActivations(ctx.user.id)
    ),
    smsRequestDetail: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .query(
        async ({ input, ctx }): Promise<DemoActivation> =>
          shouldUsePersistentStore()
            ? ((await getPersistentActivation(
                ctx.user.id,
                input.id
              )) as DemoActivation)
            : getActivation(ctx.user.id, input.id)
      ),
    simulateSms: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        if (shouldUsePersistentStore()) {
          await completePersistentActivation({
            userId: ctx.user.id,
            externalId: input.id,
            sender: "SUBBY-DEMO",
            body: "Your simulated verification code is 482913.",
            receivedAt: new Date(),
          });
          return getPersistentActivation(ctx.user.id, input.id);
        }
        return simulateSms(ctx.user.id, input.id);
      }),
    cancelSms: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        if (shouldUsePersistentStore())
          return cancelPersistentActivation(ctx.user.id, input.id);
        return cancelSms(ctx.user.id, input.id);
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
      .mutation(async ({ input, ctx }) => {
        if (shouldUsePersistentStore()) {
          const inbox = await getPersistentInbox(ctx.user.id, input.id);
          await persistCompletedInboxMessage({
            userId: ctx.user.id,
            externalId: input.id,
            fromAddress: "hello@subby.demo",
            toAddress: inbox.address,
            subject: "Demo inbox message",
            body: "This simulated email confirms your Phase 1 inbox is working.",
            receivedAt: new Date(),
          });
          return getPersistentInbox(ctx.user.id, input.id);
        }
        return simulateEmail(ctx.user.id, input.id);
      }),
    expireInbox: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        if (shouldUsePersistentStore())
          return expirePersistentInbox(ctx.user.id, input.id);
        return expireInbox(ctx.user.id, input.id);
      }),
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
        const reference = `sms-${ctx.user.id}-${Date.now()}`;
        const wallet = shouldUsePersistentStore()
          ? await debitPersistentWallet(
              ctx.user.id,
              quote.amount,
              `${quote.serviceId} demo activation`,
              reference
            )
          : debitDemoCredits(
              ctx.user.id,
              quote.amount,
              `${quote.serviceId} demo activation`,
              reference
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
        if (shouldUsePersistentStore()) {
          await persistActivation({
            userId: ctx.user.id,
            externalId: demoActivation.id,
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
    databaseHealth: adminProcedure.query(() => getDatabaseHealth()),
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
