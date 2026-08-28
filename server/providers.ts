import {
  LocalDemoMailProvider,
  MockSMSProvider,
  type MailProvider,
  type SMSProvider,
} from "./domain";
import { ExternalSmsProvider } from "./externalSmsProvider";
import {
  describeSmsProviderConfig,
  resolveSmsProviderConfig,
  type RuntimeEnv,
  type SmsProviderConfig,
} from "./smsProviderConfig";

/**
 * Provider registry / factory.
 * SMS implementation is selected from environment configuration.
 * Mail remains local-demo until a separate mail provider boundary is introduced.
 */
export class ProviderRegistry {
  private readonly mailProviders: Record<string, MailProvider> = {
    local: new LocalDemoMailProvider(),
  };
  private smsCache: { key: string; provider: SMSProvider } | null = null;

  /**
   * Validate current environment SMS provider configuration.
   * Throws on unknown mode or incomplete external configuration.
   */
  validateConfiguration(env: RuntimeEnv = process.env): SmsProviderConfig {
    return resolveSmsProviderConfig(env);
  }

  /**
   * Resolve the active SMS provider for the given environment.
   * Default is MockSMSProvider. External mode requires complete config and
   * never silently falls back to mock.
   */
  getSMS(env: RuntimeEnv = process.env): SMSProvider {
    const config = this.validateConfiguration(env);
    const cacheKey =
      config.mode === "mock"
        ? "mock"
        : `external:${config.baseUrl}:${config.apiKey.length}`;

    if (this.smsCache?.key === cacheKey) {
      return this.smsCache.provider;
    }

    const provider =
      config.mode === "mock"
        ? new MockSMSProvider()
        : new ExternalSmsProvider(config);

    this.smsCache = { key: cacheKey, provider };
    return provider;
  }

  /** Force the next getSMS() to re-resolve configuration (tests). */
  clearSmsCache() {
    this.smsCache = null;
  }

  getMail(name = "local"): MailProvider {
    const provider = this.mailProviders[name];
    if (!provider) throw new Error(`Unknown mail provider: ${name}`);
    return provider;
  }

  describe(env: RuntimeEnv = process.env) {
    try {
      return describeSmsProviderConfig(this.validateConfiguration(env));
    } catch (error) {
      return {
        mode: "invalid" as const,
        configured: false,
        error: error instanceof Error ? error.message : "invalid configuration",
      };
    }
  }

  async health(env: RuntimeEnv = process.env) {
    const sms = this.getSMS(env);
    const mail = this.getMail();
    return {
      sms: await sms.healthCheck(),
      mail: await mail.healthCheck(),
      config: this.describe(env),
    };
  }
}

export const providerRegistry = new ProviderRegistry();

/** Convenience helper used by routers and order services. */
export function getConfiguredSmsProvider(
  env: RuntimeEnv = process.env
): SMSProvider {
  return providerRegistry.getSMS(env);
}
