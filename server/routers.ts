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
import { checkRateLimit, createAuditEvent, type AuditEvent } from "./security";
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
    summary: protectedProcedure.query(({ ctx }) => ({
      user: ctx.user.name ?? "Customer",
      balance: { NGN: 24680, USD: 0 },
      activeRequests: 2,
      successRate: 98.4,
      providerMode: "mock" as const,
    })),
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
        if (!checkRateLimit(`sms:${ctx.user.id}`, 5))
          throw new Error("Request rate limit exceeded");
        const activation = await sms.buyActivation({
          ...input,
          userId: ctx.user.id,
        });
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
          ...activation,
          audit: "Mock request created; no external provider contacted.",
        };
      }),
    createMailInbox: protectedProcedure
      .input(z.object({ label: z.string().trim().min(2).max(40) }))
      .mutation(async ({ input, ctx }) => {
        if (!checkRateLimit(`mail:${ctx.user.id}`, 5))
          throw new Error("Request rate limit exceeded");
        const inbox = await mail.createTemporaryInbox({
          ...input,
          userId: ctx.user.id,
        });
        auditEvents.push(
          createAuditEvent({
            actorId: ctx.user.id,
            action: "mail.inbox.created",
            targetType: "temporaryInbox",
            targetId: inbox.id,
            metadata: { mode: "mock", label: input.label },
          })
        );
        return inbox;
      }),
    ledger: protectedProcedure.query(() => ({
      currency: "NGN" as const,
      balance: 24680,
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
    })),
  }),
  admin: router({
    overview: adminProcedure.query(() => ({
      users: 1482,
      requestsToday: 326,
      walletVolume: 1286400,
      activeProviders: 2,
      recentAudit: [
        "Mock SMS provider health check passed",
        "Manual review queue has 4 requests",
        "No policy violations detected in the last 24 hours",
      ],
      auditEvents: auditEvents.slice(-20).reverse(),
    })),
  }),
});

export type AppRouter = typeof appRouter;
