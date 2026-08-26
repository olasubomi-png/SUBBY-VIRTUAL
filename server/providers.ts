import {
  LocalDemoMailProvider,
  MockSMSProvider,
  type MailProvider,
  type SMSProvider,
} from "./domain";

export class ProviderRegistry {
  readonly sms: Record<string, SMSProvider> = { mock: new MockSMSProvider() };
  readonly mail: Record<string, MailProvider> = {
    "local-demo": new LocalDemoMailProvider(),
  };
  getSMS(name = "mock") {
    const provider = this.sms[name];
    if (!provider) throw new Error(`Unknown SMS provider: ${name}`);
    return provider;
  }
  getMail(name = "local-demo") {
    const provider = this.mail[name];
    if (!provider) throw new Error(`Unknown mail provider: ${name}`);
    return provider;
  }
  validateConfiguration() {
    if (process.env.SMS_PROVIDER_API_KEY || process.env.MAIL_PROVIDER_API_KEY) {
      throw new Error(
        "Production provider credentials are disabled in Phase 1"
      );
    }
    return { valid: true as const, mode: "mock" as const };
  }
  async health() {
    const config = this.validateConfiguration();
    const sms = await Promise.all(
      Object.entries(this.sms).map(async ([name, provider]) => {
        try {
          const result = await provider.healthCheck();
          return {
            name,
            status: result.ok ? "healthy" : "unavailable",
            detail: result.detail,
            mode: config.mode,
          };
        } catch (error) {
          return {
            name,
            status: "unavailable",
            detail:
              error instanceof Error ? error.message : "health check failed",
            mode: config.mode,
          };
        }
      })
    );
    const mail = await Promise.all(
      Object.entries(this.mail).map(async ([name, provider]) => {
        try {
          const result = await provider.healthCheck();
          return {
            name,
            status: result.ok ? "healthy" : "unavailable",
            detail: result.detail,
            mode: config.mode,
          };
        } catch (error) {
          return {
            name,
            status: "unavailable",
            detail:
              error instanceof Error ? error.message : "health check failed",
            mode: config.mode,
          };
        }
      })
    );
    return { sms, mail };
  }
}
export const providerRegistry = new ProviderRegistry();
