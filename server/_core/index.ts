import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { closeDb } from "../db";
import { getDatabaseHealth } from "../db";
import { closeRedis } from "../redis";
import { dispatchScheduledJobs, expireDemoResources } from "../jobs";
import { getServerBinding } from "../runtimeConfig";
import { isScheduledRequest } from "./sdk";
import { serveStatic, setupVite } from "./vite";

let startupClaimed = false;
let dispatcherReady = false;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (startupClaimed) throw new Error("Server startup already claimed");
  startupClaimed = true;
  const app = express();
  const server = createServer(app);
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

  // Paystack webhook requires the raw body for HMAC signature verification.
  // Must be registered BEFORE express.json().
  app.post(
    "/api/payments/paystack/webhook",
    express.raw({ type: "*/*", limit: "1mb" }),
    async (req, res) => {
      try {
        const { handlePaystackWebhook } = await import("../payments");
        const signature = String(req.header("x-paystack-signature") ?? "");
        const rawBody = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(
              typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {})
            );
        const result = await handlePaystackWebhook({ rawBody, signature });
        if (!result.ok && result.error === "invalid_signature") {
          return res.status(401).json({ error: "invalid signature" });
        }
        if (!result.ok) {
          return res.status(400).json({ error: result.error ?? "bad request" });
        }
        return res.status(200).json({ received: true });
      } catch {
        return res.status(500).json({ error: "webhook processing failed" });
      }
    }
  );

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.get("/health", async (_req, res) =>
    res.status(200).json({
      status: "ok",
      service: "subby-virtual",
      providerMode: "mock",
      database: await getDatabaseHealth(),
      jobDispatcher: {
        ready: dispatcherReady,
        mode: "scheduled-http",
        duplicateStartsGuarded: true,
      },
    })
  );
  app.post("/api/scheduled/cleanup", async (req, res) => {
    try {
      if (!isScheduledRequest(req))
        return res.status(403).json({ error: "scheduled-token-required" });
      return res.json({ ok: true, result: await expireDemoResources() });
    } catch (error) {
      return res.status(500).json({
        error: "cleanup failed",
      });
    }
  });
  app.post("/api/scheduled/dispatch-jobs", async (req, res) => {
    try {
      if (!isScheduledRequest(req))
        return res.status(403).json({ error: "scheduled-token-required" });
      const requestedLimit = Number(req.body?.limit ?? 10);
      const limit = Number.isInteger(requestedLimit)
        ? Math.max(1, Math.min(requestedLimit, 25))
        : 10;
      return res.json({ ok: true, result: await dispatchScheduledJobs(limit) });
    } catch (error) {
      return res.status(500).json({
        error: "job dispatch failed",
      });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const binding = getServerBinding();
  const port = binding.allowPortFallback
    ? await findAvailablePort(binding.port)
    : binding.port;

  if (port !== binding.port) {
    console.log(`Port ${binding.port} is busy, using port ${port} instead`);
  }

  dispatcherReady = true;
  server.listen(port, binding.host, () => {
    console.log(`Server running on http://${binding.host}:${port}/`);
    console.log(
      `[Jobs] Dispatcher ready via /api/scheduled/dispatch-jobs; in-process timers disabled`
    );
  });
  const shutdown = async () => {
    await closeRedis();
    await closeDb();
    server.close(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

startServer().catch(console.error);
