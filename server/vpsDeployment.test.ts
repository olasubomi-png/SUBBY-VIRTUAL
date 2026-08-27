import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("VPS deployment artifacts", () => {
  it("keeps environment files ignored while providing a credential-free deployment template", () => {
    const gitignore = readProjectFile(".gitignore");
    const template = readProjectFile("deploy/env.example");
    expect(gitignore).toContain(".env.*");
    expect(template).toContain("HOST=127.0.0.1");
    expect(template).toContain("DATABASE_URL=postgresql://");
    expect(template).toContain("JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET");
    expect(template).toContain("REPLACE_WITH_STRONG_PASSWORD");
    expect(template).not.toContain("postgresql://subby_app:actual-password@");
  });

  it("runs exactly one loopback-bound PM2 process using the compiled application entry point", () => {
    const pm2 = readProjectFile("ecosystem.config.cjs");
    expect(pm2).toContain('name: "SUBBY-VIRTUAL"');
    expect(pm2).toContain('script: "dist/index.js"');
    expect(pm2).toContain("instances: 1");
    expect(pm2).toContain('HOST: "127.0.0.1"');
    expect(pm2).toContain('PORT: "3003"');
    expect(pm2).not.toMatch(/JWT_SECRET|DATABASE_URL|REDIS_URL/);
  });

  it("proxies the domain only to the local application port with required forwarded headers", () => {
    const nginx = readProjectFile("deploy/nginx/subby.kdns.fr.conf");
    expect(nginx).toContain("server_name subby.kdns.fr;");
    expect(nginx).toContain("proxy_pass http://127.0.0.1:3003;");
    expect(nginx).toContain("proxy_set_header Host $host;");
    expect(nginx).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
    expect(nginx).not.toContain("ssl_certificate");
  });
});
