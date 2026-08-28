import { describe, expect, it } from "vitest";
import {
  getBootstrapAdminEmail,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "./localAuth";

describe("self-hosted authentication helpers", () => {
  it("normalizes bootstrap admin configuration without exposing the value", () => {
    const configured =
      process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    expect(getBootstrapAdminEmail()).toBe(configured || null);
  });

  it("hashes and verifies passwords with a salted one-way digest", async () => {
    const password = "correct horse battery staple";
    const encoded = await hashPassword(password);
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(encoded).not.toContain(password);
    expect(await verifyPassword(password, encoded)).toBe(true);
    expect(await verifyPassword("wrong password", encoded)).toBe(false);
  });

  it("normalizes account emails consistently", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});
