import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { ENV } from "./env";

export type SessionPayload = {
  userId: number;
};

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

class SDKServer {
  private getSessionSecret() {
    if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required");
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    userId: number,
    options: { expiresInMs?: number } = {}
  ) {
    return this.signSession({ userId }, options);
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    return new SignJWT({ userId: payload.userId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(Math.floor((issuedAt + expiresInMs) / 1000))
      .sign(this.getSessionSecret());
  }

  async verifySession(cookieValue: string | undefined | null) {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(
        cookieValue,
        this.getSessionSecret(),
        { algorithms: ["HS256"] }
      );
      const userId = payload.userId;
      return isPositiveInteger(userId) ? { userId } : null;
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const session = await this.verifySession(cookies[COOKIE_NAME]);
    if (!session) throw ForbiddenError("Invalid session cookie");
    const user = await db.getUserById(session.userId);
    if (!user || user.status !== "active") {
      throw ForbiddenError("Invalid session user");
    }
    return user;
  }
}

export function isScheduledRequest(req: Request) {
  const expected = ENV.scheduledDispatchToken;
  const header = req.headers.authorization;
  if (!expected || typeof header !== "string") return false;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const actual = header.slice(prefix.length);
  return actual.length === expected.length && actual === expected;
}

export const sdk = new SDKServer();
