import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    setupFiles: [path.resolve(templateRoot, "server/test/setup.ts")],
    // Baseline env for the worker process (does not replace setupFiles isolation)
    env: {
      SMS_PROVIDER: "mock",
      SMS_PROVIDER_BASE_URL: "",
      SMS_PROVIDER_API_KEY: "",
      SMS_PROVIDER_API_SECRET: "",
      SMS_MARKUP_BPS: "0",
    },
  },
});
