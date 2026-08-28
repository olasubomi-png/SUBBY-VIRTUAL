/**
 * Payment provider abstraction — Mock + Paystack.
 * Secrets never leave the server process.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  describePaymentProviderConfig,
  resolvePaymentProviderConfig,
  type PaymentProviderConfig,
  type RuntimeEnv,
} from "./paymentProviderConfig";

export type PaymentInitResult = {
  provider: "mock" | "paystack";
  reference: string;
  authorizationUrl: string;
  accessCode?: string;
};

export type PaymentVerifyResult = {
  reference: string;
  status: "success" | "failed" | "pending" | "abandoned";
  amountMinor: number;
  currency: string;
  paidAt?: string;
  providerStatus: string;
};

export type PaymentProvider = {
  readonly mode: "mock" | "paystack";
  initialize(input: {
    email: string;
    amountMinor: number;
    reference: string;
    currency: "NGN";
    metadata?: Record<string, string | number | boolean>;
    callbackUrl?: string;
  }): Promise<PaymentInitResult>;
  verify(reference: string): Promise<PaymentVerifyResult>;
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
};

export type PaymentFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export class MockPaymentProvider implements PaymentProvider {
  readonly mode = "mock" as const;
  private readonly verified = new Map<string, PaymentVerifyResult>();

  async initialize(input: {
    email: string;
    amountMinor: number;
    reference: string;
    currency: "NGN";
  }): Promise<PaymentInitResult> {
    this.verified.set(input.reference, {
      reference: input.reference,
      status: "pending",
      amountMinor: input.amountMinor,
      currency: input.currency,
      providerStatus: "pending",
    });
    return {
      provider: "mock",
      reference: input.reference,
      authorizationUrl: `/wallet?payment=mock&reference=${encodeURIComponent(input.reference)}`,
      accessCode: `mock_${input.reference}`,
    };
  }

  /** Test helper — mark a mock payment successful. */
  completeForTests(reference: string, amountMinor: number, currency = "NGN") {
    this.verified.set(reference, {
      reference,
      status: "success",
      amountMinor,
      currency,
      paidAt: new Date().toISOString(),
      providerStatus: "success",
    });
  }

  failForTests(reference: string, amountMinor: number) {
    this.verified.set(reference, {
      reference,
      status: "failed",
      amountMinor,
      currency: "NGN",
      providerStatus: "failed",
    });
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    const row = this.verified.get(reference);
    if (!row) {
      return {
        reference,
        status: "pending",
        amountMinor: 0,
        currency: "NGN",
        providerStatus: "not_found",
      };
    }
    return row;
  }

  verifyWebhookSignature(_rawBody: Buffer | string, signature: string): boolean {
    return signature === "mock-valid-signature";
  }

  async healthCheck() {
    return { ok: true, detail: "mock payment provider" };
  }
}

export class PaystackPaymentProvider implements PaymentProvider {
  readonly mode = "paystack" as const;
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly baseUrl: string;
  private readonly callbackUrl: string;
  private readonly fetchImpl: PaymentFetch;
  private readonly timeoutMs: number;

  constructor(
    config: Extract<PaymentProviderConfig, { mode: "paystack" }>,
    options?: { fetchImpl?: PaymentFetch; timeoutMs?: number }
  ) {
    if (config.mode !== "paystack") {
      throw new Error('PaystackPaymentProvider requires mode "paystack"');
    }
    this.secretKey = config.secretKey;
    this.publicKey = config.publicKey;
    this.baseUrl = config.baseUrl;
    this.callbackUrl = config.callbackUrl;
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.timeoutMs = options?.timeoutMs ?? 15_000;
  }

  private async request(
    path: string,
    init: RequestInit = {}
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init.headers ?? {}),
        },
      });
      const body = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error("Malformed Paystack response");
      }
      if (!response.ok) {
        throw new Error(`Paystack HTTP ${response.status}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async initialize(input: {
    email: string;
    amountMinor: number;
    reference: string;
    currency: "NGN";
    metadata?: Record<string, string | number | boolean>;
    callbackUrl?: string;
  }): Promise<PaymentInitResult> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error("Invalid payment amount");
    }
    const data = (await this.request("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl ?? this.callbackUrl,
        metadata: input.metadata ?? {},
      }),
    })) as {
      status?: boolean;
      data?: {
        authorization_url?: string;
        access_code?: string;
        reference?: string;
      };
    };
    if (!data?.status || !data.data?.authorization_url || !data.data.reference) {
      throw new Error("Paystack initialization failed");
    }
    return {
      provider: "paystack",
      reference: data.data.reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    const data = (await this.request(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: "GET" }
    )) as {
      status?: boolean;
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        reference?: string;
        paid_at?: string;
      };
    };
    if (!data?.status || !data.data) {
      return {
        reference,
        status: "pending",
        amountMinor: 0,
        currency: "NGN",
        providerStatus: "unverified",
      };
    }
    const ps = (data.data.status ?? "").toLowerCase();
    let status: PaymentVerifyResult["status"] = "pending";
    if (ps === "success") status = "success";
    else if (ps === "failed" || ps === "reversed") status = "failed";
    else if (ps === "abandoned") status = "abandoned";
    return {
      reference: data.data.reference ?? reference,
      status,
      amountMinor: Number(data.data.amount ?? 0),
      currency: (data.data.currency ?? "NGN").toUpperCase(),
      paidAt: data.data.paid_at,
      providerStatus: ps,
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!signature) return false;
    const hash = createHmac("sha512", this.secretKey)
      .update(typeof rawBody === "string" ? rawBody : rawBody)
      .digest("hex");
    try {
      const a = Buffer.from(hash, "utf8");
      const b = Buffer.from(signature, "utf8");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async healthCheck() {
    try {
      // Lightweight authenticated call
      await this.request("/bank?perPage=1", { method: "GET" });
      return {
        ok: true,
        detail: this.secretKey.startsWith("sk_test_")
          ? "paystack test mode reachable"
          : "paystack live mode reachable",
      };
    } catch {
      return { ok: false, detail: "paystack unreachable or unauthorized" };
    }
  }

  getPublicKey() {
    return this.publicKey;
  }
}

class PaymentProviderRegistry {
  private cache: {
    key: string;
    provider: PaymentProvider;
  } | null = null;

  getProvider(env: RuntimeEnv = process.env): PaymentProvider {
    const config = resolvePaymentProviderConfig(env);
    const key =
      config.mode === "mock"
        ? "mock"
        : `paystack:${config.secretKey.slice(0, 12)}:${config.baseUrl}`;
    if (this.cache?.key === key) return this.cache.provider;
    const provider: PaymentProvider =
      config.mode === "mock"
        ? new MockPaymentProvider()
        : new PaystackPaymentProvider(config);
    this.cache = { key, provider };
    return provider;
  }

  clearCache() {
    this.cache = null;
  }

  describe(env: RuntimeEnv = process.env) {
    try {
      return describePaymentProviderConfig(resolvePaymentProviderConfig(env));
    } catch (error) {
      return {
        mode: "invalid" as const,
        configured: false,
        error: error instanceof Error ? error.message : "invalid",
      };
    }
  }

  async health(env: RuntimeEnv = process.env) {
    try {
      const provider = this.getProvider(env);
      return {
        provider: await provider.healthCheck(),
        config: this.describe(env),
      };
    } catch (error) {
      return {
        provider: {
          ok: false,
          detail: error instanceof Error ? error.message : "invalid",
        },
        config: this.describe(env),
      };
    }
  }
}

export const paymentProviderRegistry = new PaymentProviderRegistry();

export function getConfiguredPaymentProvider(
  env: RuntimeEnv = process.env
): PaymentProvider {
  return paymentProviderRegistry.getProvider(env);
}
