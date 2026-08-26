import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { closeDb } from "../db";
import { closeRedis } from "../redis";
import { dispatchScheduledJobs, expireDemoResources } from "../jobs";
import { sdk } from "./sdk";
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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/health", (_req, res) =>
    res.status(200).json({
      status: "ok",
      service: "subby-virtual",
      providerMode: "mock",
      jobDispatcher: {
        ready: dispatcherReady,
        mode: "scheduled-http",
        duplicateStartsGuarded: true,
      },
    })
  );
  app.post("/api/scheduled/cleanup", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      return res.json({ ok: true, result: await expireDemoResources() });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "cleanup failed",
      });
    }
  });
  app.post("/api/scheduled/dispatch-jobs", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const requestedLimit = Number(req.body?.limit ?? 10);
      const limit = Number.isInteger(requestedLimit)
        ? Math.max(1, Math.min(requestedLimit, 25))
        : 10;
      return res.json({ ok: true, result: await dispatchScheduledJobs(limit) });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "job dispatch failed",
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  dispatcherReady = true;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
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
