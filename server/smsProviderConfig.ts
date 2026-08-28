/**
 * SMS provider selection and configuration boundary.
 *
 * Default: mock (MockSMSProvider) — safe for development, tests, and demo.
 * External mode is opt-in via SMS_PROVIDER=external and requires complete
 * credentials. Partial external configuration never falls back to mock.
 */

export const SMS_PROVIDER_MODES = ["mock", "external"] as const;
export type SmsProviderMode = (typeof SMS_PROVIDER_MODES)[number];

export type SmsProviderConfig =
  | { mode: "mock" }
  | {
      mode: "external";
      baseUrl: string;
      apiKey: string;
      /** Optional secondary secret if a future adapter needs it. */
      apiSecret?: string;
    };

export type RuntimeEnv = Record<string, string | undefined>;

const DEFAULT_MODE: SmsProviderMode = "mock";

function readMode(env: RuntimeEnv): SmsProviderMode {
  const raw = (env.SMS_PROVIDER ?? DEFAULT_MODE).trim().toLowerCase();
  if (!raw) return DEFAULT_MODE;
  if ((SMS_PROVIDER_MODES as readonly string[]).includes(raw)) {
    return raw as SmsProviderMode;
  }
  throw new Error(
    `Unknown SMS provider "${raw}". Supported values: ${SMS_PROVIDER_MODES.join(", ")}`
  );
}

/**
 * Resolve and validate SMS provider configuration from the environment.
 * Does not construct providers or contact external networks.
 */
export function resolveSmsProviderConfig(
  env: RuntimeEnv = process.env
): SmsProviderConfig {
  const mode = readMode(env);

  if (mode === "mock") {
    return { mode: "mock" };
  }

  // mode === "external" — all required fields must be present; no silent fallback
  const baseUrl = env.SMS_PROVIDER_BASE_URL?.trim() ?? "";
  const apiKey = env.SMS_PROVIDER_API_KEY?.trim() ?? "";
  const apiSecret = env.SMS_PROVIDER_API_SECRET?.trim() || undefined;

  const missing: string[] = [];
  if (!baseUrl) missing.push("SMS_PROVIDER_BASE_URL");
  if (!apiKey) missing.push("SMS_PROVIDER_API_KEY");

  if (missing.length > 0) {
    throw new Error(
      `SMS provider configuration is incomplete for mode "external". Missing: ${missing.join(", ")}. ` +
        `Set the required variables or use SMS_PROVIDER=mock.`
    );
  }

  try {
    // Validate URL shape without performing a network request
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error(
      "SMS_PROVIDER_BASE_URL must be a valid http(s) URL when SMS_PROVIDER=external"
    );
  }

  return {
    mode: "external",
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    apiSecret,
  };
}

/** True when the resolved config selects the mock provider. */
export function isMockSmsProviderConfig(
  config: SmsProviderConfig
): config is { mode: "mock" } {
  return config.mode === "mock";
}

/**
 * Safe summary for logs/health — never includes secrets.
 */
export function describeSmsProviderConfig(config: SmsProviderConfig): {
  mode: SmsProviderMode;
  configured: boolean;
} {
  if (config.mode === "mock") {
    return { mode: "mock", configured: true };
  }
  return {
    mode: "external",
    configured: Boolean(config.baseUrl && config.apiKey),
  };
}
