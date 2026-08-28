import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  handlePaystackWebhook,
  initializePointTopUp,
  settleTopUpFromProvider,
} from "./payments";
import {
  MockPaymentProvider,
  PaystackPaymentProvider,
  paymentProviderRegistry,
} from "./paymentProviders";
import { resolvePaymentProviderConfig } from "./paymentProviderConfig";
import { getPointPackage, listPointPackages } from "./pointPackages";

afterEach(() => paymentProviderRegistry.clearCache());

describe("point packages", () => {
  it("exposes server-authoritative packages", () => {
    const packages = listPointPackages();
    expect(packages.length).toBeGreaterThan(0);
    expect(getPointPackage("pts_5k").points).toBe(5000);
    expect(() => getPointPackage("nope")).toThrow(/Unknown/);
  });
});

describe("payment provider config", () => {
  it("defaults to mock", () => {
    expect(resolvePaymentProviderConfig({}).mode).toBe("mock");
  });

  it("fails closed for incomplete paystack config", () => {
    expect(() =>
      resolvePaymentProviderConfig({ PAYMENT_PROVIDER: "paystack" })
    ).toThrow(/incomplete/);
  });

  it("accepts complete paystack config", () => {
    const config = resolvePaymentProviderConfig({
      PAYMENT_PROVIDER: "paystack",
      PAYSTACK_SECRET_KEY: "sk_test_abc",
      PAYSTACK_PUBLIC_KEY: "pk_test_abc",
      APP_URL: "https://subomivirtual.kdns.fr",
    });
    expect(config.mode).toBe("paystack");
    if (config.mode === "paystack") {
      expect(config.secretKey).toContain("sk_test_");
    }
  });
});

describe("MockPaymentProvider", () => {
  it("initializes and verifies success without network", async () => {
    const provider = new MockPaymentProvider();
    const init = await provider.initialize({
      email: "a@b.com",
      amountMinor: 5000,
      reference: "sbp_1_test",
      currency: "NGN",
    });
    expect(init.authorizationUrl).toContain("reference=");
    provider.completeForTests("sbp_1_test", 5000);
    const verified = await provider.verify("sbp_1_test");
    expect(verified.status).toBe("success");
    expect(verified.amountMinor).toBe(5000);
    expect(verified.currency).toBe("NGN");
  });

  it("validates mock webhook signatures", () => {
    const provider = new MockPaymentProvider();
    expect(provider.verifyWebhookSignature("{}", "mock-valid-signature")).toBe(
      true
    );
    expect(provider.verifyWebhookSignature("{}", "bad")).toBe(false);
  });
});

describe("PaystackPaymentProvider", () => {
  it("initializes via HTTP API", async () => {
    const provider = new PaystackPaymentProvider(
      {
        mode: "paystack",
        secretKey: "sk_test_x",
        publicKey: "pk_test_x",
        baseUrl: "https://api.paystack.co",
        callbackUrl: "https://subomivirtual.kdns.fr/wallet?payment=return",
      },
      {
        fetchImpl: async (_url, init) => {
          const body = JSON.parse(String(init?.body ?? "{}"));
          expect(body.amount).toBe(5000);
          expect(body.currency).toBe("NGN");
          expect(body.reference).toBe("sbp_9_ref");
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                status: true,
                data: {
                  authorization_url: "https://checkout.paystack.com/abc",
                  access_code: "access",
                  reference: "sbp_9_ref",
                },
              }),
          } as Response;
        },
      }
    );
    const result = await provider.initialize({
      email: "user@example.com",
      amountMinor: 5000,
      reference: "sbp_9_ref",
      currency: "NGN",
    });
    expect(result.authorizationUrl).toContain("paystack.com");
  });

  it("verifies signature with HMAC SHA512", () => {
    const secret = "sk_test_secret";
    const provider = new PaystackPaymentProvider({
      mode: "paystack",
      secretKey: secret,
      publicKey: "pk_test_x",
      baseUrl: "https://api.paystack.co",
      callbackUrl: "https://example.com/wallet?payment=return",
    });
    const raw = '{"event":"charge.success","data":{"reference":"r1"}}';
    const sig = createHmac("sha512", secret).update(raw).digest("hex");
    expect(provider.verifyWebhookSignature(raw, sig)).toBe(true);
    expect(provider.verifyWebhookSignature(raw, "deadbeef")).toBe(false);
  });

  it("detects amount and status from verify API", async () => {
    const provider = new PaystackPaymentProvider(
      {
        mode: "paystack",
        secretKey: "sk_test_x",
        publicKey: "pk_test_x",
        baseUrl: "https://api.paystack.co",
        callbackUrl: "https://example.com/cb",
      },
      {
        fetchImpl: async () =>
          ({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                status: true,
                data: {
                  status: "success",
                  amount: 5000,
                  currency: "NGN",
                  reference: "ref-1",
                },
              }),
          }) as Response,
      }
    );
    const verified = await provider.verify("ref-1");
    expect(verified).toMatchObject({
      status: "success",
      amountMinor: 5000,
      currency: "NGN",
    });
  });
});

describe("webhook handler", () => {
  it("rejects invalid signatures", async () => {
    const provider = new MockPaymentProvider();
    const result = await handlePaystackWebhook({
      rawBody: Buffer.from("{}"),
      signature: "invalid",
      provider,
    });
    expect(result).toEqual({ ok: false, error: "invalid_signature" });
  });

  it("ignores unrelated events", async () => {
    const provider = new MockPaymentProvider();
    const result = await handlePaystackWebhook({
      rawBody: Buffer.from(
        JSON.stringify({ event: "transfer.success", data: {} })
      ),
      signature: "mock-valid-signature",
      provider,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ignored).toBe(true);
  });
});

describe("initialize top-up (demo mode)", () => {
  it("returns authorization URL for valid package", async () => {
    const provider = new MockPaymentProvider();
    const result = await initializePointTopUp({
      userId: 1,
      email: "a@b.com",
      packageId: "pts_1k",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      provider,
    });
    expect(result.points).toBe(1000);
    expect(result.amountMinor).toBe(1000);
    expect(result.authorizationUrl).toBeTruthy();
    expect(result.reference).toContain("sbp_1_");
  });

  it("rejects unknown package", async () => {
    await expect(
      initializePointTopUp({
        userId: 1,
        email: "a@b.com",
        packageId: "invalid",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
        provider: new MockPaymentProvider(),
      })
    ).rejects.toThrow(/Unknown/);
  });
});
