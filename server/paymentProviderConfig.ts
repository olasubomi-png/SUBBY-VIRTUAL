/**
 * Payment provider selection. Default: mock (safe for tests/dev).
 * PAYMENT_PROVIDER=paystack requires complete credentials — fail closed.
 */

export const PAYMENT_PROVIDER_MODES = ["mock", "paystack"] as const;
export type PaymentProviderMode = (typeof PAYMENT_PROVIDER_MODES)[number];

export type PaymentProviderConfig =
  | { mode: "mock" }
  | {
      mode: "paystack";
      secretKey: string;
      publicKey: string;
      baseUrl: string;
      callbackUrl: string;
    };

export type RuntimeEnv = Record<string, string | undefined>;

function readMode(env: RuntimeEnv): PaymentProviderMode {
  const raw = (env.PAYMENT_PROVIDER ?? "mock").trim().toLowerCase();
  if (!raw) return "mock";
  if ((PAYMENT_PROVIDER_MODES as readonly string[]).includes(raw)) {
    return raw as PaymentProviderMode;
  }
  throw new Error(
    `Unknown payment provider "${raw}". Supported: ${PAYMENT_PROVIDER_MODES.join(", ")}`
  );
}

export function resolvePaymentProviderConfig(
  env: RuntimeEnv = process.env
): PaymentProviderConfig {
  const mode = readMode(env);
  if (mode === "mock") return { mode: "mock" };

  const secretKey = env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  const publicKey = env.PAYSTACK_PUBLIC_KEY?.trim() ?? "";
  const baseUrl = (
    env.PAYSTACK_BASE_URL?.trim() || "https://api.paystack.co"
  ).replace(/\/+$/, "");
  const appUrl = (env.APP_URL?.trim() || "").replace(/\/+$/, "");
  const callbackUrl =
    env.PAYSTACK_CALLBACK_URL?.trim() ||
    (appUrl ? `${appUrl}/wallet?payment=return` : "");

  const missing: string[] = [];
  if (!secretKey) missing.push("PAYSTACK_SECRET_KEY");
  if (!publicKey) missing.push("PAYSTACK_PUBLIC_KEY");
  if (!callbackUrl) missing.push("APP_URL or PAYSTACK_CALLBACK_URL");
  if (missing.length > 0) {
    throw new Error(
      `Payment provider configuration incomplete for mode "paystack". Missing: ${missing.join(", ")}. ` +
        `Set the required variables or use PAYMENT_PROVIDER=mock.`
    );
  }
  if (!secretKey.startsWith("sk_")) {
    throw new Error("PAYSTACK_SECRET_KEY must start with sk_test_ or sk_live_");
  }
  if (!publicKey.startsWith("pk_")) {
    throw new Error("PAYSTACK_PUBLIC_KEY must start with pk_test_ or pk_live_");
  }

  return {
    mode: "paystack",
    secretKey,
    publicKey,
    baseUrl,
    callbackUrl,
  };
}

export function describePaymentProviderConfig(config: PaymentProviderConfig) {
  if (config.mode === "mock") {
    return { mode: "mock" as const, configured: true, testMode: true };
  }
  return {
    mode: "paystack" as const,
    configured: true,
    testMode: config.secretKey.startsWith("sk_test_"),
    publicKey: config.publicKey,
    // never include secretKey
  };
}
