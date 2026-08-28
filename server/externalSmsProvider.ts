/**
 * Boundary adapter for a future live SMS activation provider.
 *
 * This class does NOT call any commercial SMS API. Construction is only allowed
 * when resolveSmsProviderConfig() has already validated a complete external
 * configuration. Method calls throw until a concrete adapter is implemented.
 */
import type { Currency, SMSProvider } from "./domain";
import type { SmsProviderConfig } from "./smsProviderConfig";

export class ExternalSmsProvider implements SMSProvider {
  readonly mode = "external" as const;
  private readonly baseUrl: string;
  // Credentials are held for a future adapter; never logged or returned.
  private readonly apiKey: string;
  private readonly apiSecret?: string;

  constructor(config: Extract<SmsProviderConfig, { mode: "external" }>) {
    if (config.mode !== "external") {
      throw new Error("ExternalSmsProvider requires mode \"external\"");
    }
    if (!config.baseUrl || !config.apiKey) {
      throw new Error(
        "ExternalSmsProvider cannot initialize without complete configuration"
      );
    }
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  private notImplemented(operation: string): never {
    throw new Error(
      `Live SMS provider adapter is not implemented yet (operation: ${operation}). ` +
        `Configured endpoint: ${this.baseUrl}. Keep SMS_PROVIDER=mock until a concrete adapter is added.`
    );
  }

  async healthCheck() {
    // Do not contact the remote network in this boundary step.
    return {
      ok: false,
      detail:
        "external SMS adapter configured but not implemented; no upstream call performed",
    };
  }

  async getCountries() {
    this.notImplemented("getCountries");
  }

  async getServices() {
    this.notImplemented("getServices");
  }

  async getPricing(): Promise<
    Array<{ serviceId: string; amount: number; currency: Currency }>
  > {
    this.notImplemented("getPricing");
  }

  async buyActivation(_input: {
    userId: number;
    country: string;
    serviceId: string;
  }) {
    this.notImplemented("buyActivation");
  }

  async getStatus(_activationId: string) {
    this.notImplemented("getStatus");
  }

  async cancelActivation(_activationId: string) {
    this.notImplemented("cancelActivation");
  }
}
