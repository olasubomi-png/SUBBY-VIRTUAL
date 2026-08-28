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
    expect(template).toContain("PORT=3003");
    expect(template).toContain("APP_URL=https://subomivirtual.kdns.fr");
    expect(template).toContain("DATABASE_URL=postgresql://");
    expect(template).toContain("JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET");
    expect(template).toContain("AUTH_BOOTSTRAP_ADMIN_EMAIL=admin@example.com");
    expect(template).not.toMatch(
      /VITE_APP_ID|VITE_OAUTH_PORTAL_URL|OAUTH_SERVER_URL|OWNER_OPEN_ID/
    );
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

  it("uses the dedicated production domain and proxies it only to the local application port", () => {
    const nginx = readProjectFile("deploy/nginx/subomivirtual.kdns.fr.conf");
    const vpsGuide = readProjectFile("docs/VPS_DEPLOYMENT.md");
    expect(nginx).toContain("server_name subomivirtual.kdns.fr;");
    expect(nginx).toContain("proxy_pass http://127.0.0.1:3003;");
    expect(nginx).toContain("proxy_set_header Host $host;");
    expect(nginx).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
    expect(nginx).not.toContain("ssl_certificate");
    expect(vpsGuide).toContain("https://subomivirtual.kdns.fr");
    const deprecatedDomain = ["subby", "kdns", "fr"].join(".");
    expect(vpsGuide).not.toContain(deprecatedDomain);
  });
});
