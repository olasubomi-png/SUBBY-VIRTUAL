/**
 * Production external SMS adapter — SMS-Activate-compatible HTTP API.
 *
 * Protocol (publicly documented SMS-Activate handler API style):
 *   GET {baseUrl}?api_key=…&action=getBalance
 *   GET {baseUrl}?api_key=…&action=getNumber&service=…&country=…
 *   GET {baseUrl}?api_key=…&action=getStatus&id=…
 *   GET {baseUrl}?api_key=…&action=setStatus&id=…&status=8|6
 *
 * This adapter never logs API keys, authorization material, or full upstream bodies.
 * Network access occurs only when constructed with a validated external config.
 */
import type { Currency, SMSProvider } from "./domain";
import type { SmsProviderConfig } from "./smsProviderConfig";
import { SmsProviderError } from "./smsProviderErrors";
import {
  ISO_TO_PROVIDER_COUNTRY,
  PROVIDER_SERVICE_LABELS,
  SERVICE_TO_PROVIDER_CODE,
  mapCountryToProviderId,
  mapProviderStatusText,
  mapServiceToProviderCode,
} from "./smsProviderMapping";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CURRENCY: Currency = "NGN";
/** Fallback unit conversion when provider returns floating major units (USD-like). */
const DEFAULT_MAJOR_TO_MINOR = 100;

export type ExternalSmsFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export type ExternalSmsProviderOptions = {
  fetchImpl?: ExternalSmsFetch;
  timeoutMs?: number;
  /** Override major→minor multiplier for pricing (tests). */
  majorToMinor?: number;
};

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("api_key")) {
      parsed.searchParams.set("api_key", "[redacted]");
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

export class ExternalSmsProvider implements SMSProvider {
  readonly mode = "external" as const;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: ExternalSmsFetch;
  private readonly timeoutMs: number;
  private readonly majorToMinor: number;

  constructor(
    config: Extract<SmsProviderConfig, { mode: "external" }>,
    options: ExternalSmsProviderOptions = {}
  ) {
    if (config.mode !== "external") {
      throw new Error('ExternalSmsProvider requires mode "external"');
    }
    if (!config.baseUrl || !config.apiKey) {
      throw new Error(
        "ExternalSmsProvider cannot initialize without complete configuration"
      );
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.majorToMinor = options.majorToMinor ?? DEFAULT_MAJOR_TO_MINOR;
  }

  private buildUrl(params: Record<string, string | number>): string {
    const url = new URL(this.baseUrl);
    url.searchParams.set("api_key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async request(
    params: Record<string, string | number>
  ): Promise<string> {
    const url = this.buildUrl(params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "text/plain, application/json" },
      });
      const body = await response.text();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new SmsProviderError(
            "PROVIDER_AUTH",
            "Provider authentication rejected",
            { retryable: false }
          );
        }
        if (response.status === 429) {
          throw new SmsProviderError(
            "PROVIDER_RATE_LIMITED",
            "Provider rate limit exceeded",
            { retryable: true }
          );
        }
        if (response.status >= 500) {
          throw new SmsProviderError(
            "PROVIDER_UNAVAILABLE",
            "Provider upstream error",
            { retryable: true }
          );
        }
        throw new SmsProviderError(
          "PROVIDER_REJECTED",
          `Provider HTTP ${response.status}`,
          { retryable: false }
        );
      }
      return body.trim();
    } catch (error) {
      if (error instanceof SmsProviderError) throw error;
      if (
        error instanceof Error &&
        (error.name === "AbortError" || /aborted|timeout/i.test(error.message))
      ) {
        throw new SmsProviderError(
          "PROVIDER_TIMEOUT",
          "Provider request timed out",
          { retryable: true, cause: error }
        );
      }
      throw new SmsProviderError(
        "PROVIDER_UNAVAILABLE",
        "Provider network error",
        { retryable: true, cause: error }
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private interpretErrorBody(body: string): never {
    const upper = body.toUpperCase();
    if (upper.includes("NO_NUMBERS") || upper === "NO_NUMBER") {
      throw new SmsProviderError(
        "PROVIDER_NO_NUMBERS",
        "No numbers available",
        { retryable: true }
      );
    }
    if (upper.includes("NO_BALANCE") || upper.includes("NOT_ENOUGH_MONEY")) {
      throw new SmsProviderError(
        "PROVIDER_REJECTED",
        "Provider account has insufficient balance",
        { retryable: false }
      );
    }
    if (
      upper.includes("BAD_KEY") ||
      upper.includes("WRONG_KEY") ||
      upper.includes("UNAUTHORIZED")
    ) {
      throw new SmsProviderError(
        "PROVIDER_AUTH",
        "Invalid provider API key",
        { retryable: false }
      );
    }
    if (upper.includes("BANNED") || upper.includes("BLOCKED")) {
      throw new SmsProviderError(
        "PROVIDER_AUTH",
        "Provider account restricted",
        { retryable: false }
      );
    }
    if (upper.includes("WRONG_SERVICE") || upper.includes("BAD_SERVICE")) {
      throw new SmsProviderError(
        "PROVIDER_REJECTED",
        "Unsupported service at provider",
        { retryable: false }
      );
    }
    if (upper.includes("NO_NUMBERS") || body === "NO_NUMBERS") {
      throw new SmsProviderError(
        "PROVIDER_NO_NUMBERS",
        "No numbers available",
        { retryable: true }
      );
    }
    throw new SmsProviderError(
      "PROVIDER_REJECTED",
      "Provider rejected the request",
      { retryable: false }
    );
  }

  async healthCheck(): Promise<{
    ok: boolean;
    detail: string;
    balanceMajor?: number;
  }> {
    try {
      const body = await this.request({ action: "getBalance" });
      // ACCESS_BALANCE:12.34
      if (body.startsWith("ACCESS_BALANCE:")) {
        const raw = body.slice("ACCESS_BALANCE:".length);
        const balance = Number(raw);
        if (!Number.isFinite(balance)) {
          return { ok: false, detail: "Provider balance response malformed" };
        }
        return {
          ok: true,
          detail: "external SMS provider reachable",
          balanceMajor: balance,
        };
      }
      if (
        body.toUpperCase().includes("BAD_KEY") ||
        body.toUpperCase().includes("WRONG_KEY")
      ) {
        return { ok: false, detail: "Provider authentication invalid" };
      }
      return { ok: false, detail: "Provider health response unrecognized" };
    } catch (error) {
      if (error instanceof SmsProviderError) {
        return { ok: false, detail: error.message };
      }
      return { ok: false, detail: "Provider unreachable" };
    }
  }

  async getCountries() {
    return Object.keys(ISO_TO_PROVIDER_COUNTRY)
      .filter(code => code.length === 2)
      .sort()
      .map(code => ({
        code,
        name: code,
      }));
  }

  async getServices() {
    const seen = new Set<string>();
    const services: Array<{ id: string; name: string }> = [];
    for (const [serviceId, providerCode] of Object.entries(
      SERVICE_TO_PROVIDER_CODE
    )) {
      if (seen.has(serviceId)) continue;
      seen.add(serviceId);
      services.push({
        id: serviceId,
        name: PROVIDER_SERVICE_LABELS[providerCode] ?? serviceId,
      });
    }
    return services;
  }

  /**
   * Legacy flat pricing list. Prefer the catalog service for authoritative
   * retail prices. This method remains for interface compatibility and returns
   * an empty list so callers do not silently use mock amounts in external mode.
   */
  async getPricing(): Promise<
    Array<{ serviceId: string; amount: number; currency: Currency }>
  > {
    return [];
  }

  /**
   * Raw getPrices JSON from the SMS-Activate-compatible API.
   * Used by the catalog layer for live provider cost + availability.
   */
  async fetchPricesJson(): Promise<string> {
    return this.request({ action: "getPrices" });
  }

  async buyActivation(input: {

    userId: number;
    country: string;
    serviceId: string;
  }) {
    let service: string;
    let countryId: number;
    try {
      service = mapServiceToProviderCode(input.serviceId);
      countryId = mapCountryToProviderId(input.country);
    } catch (error) {
      throw new SmsProviderError(
        "PROVIDER_REJECTED",
        error instanceof Error ? error.message : "Unsupported catalog entry",
        { retryable: false }
      );
    }

    const body = await this.request({
      action: "getNumber",
      service,
      country: countryId,
    });

    // ACCESS_NUMBER:activationId:phone
    if (body.startsWith("ACCESS_NUMBER:")) {
      const parts = body.split(":");
      if (parts.length < 3) {
        throw new SmsProviderError(
          "PROVIDER_MALFORMED",
          "Malformed allocation response",
          { retryable: false }
        );
      }
      const id = parts[1]?.trim();
      const phoneNumber = parts.slice(2).join(":").trim();
      if (!id || !phoneNumber) {
        throw new SmsProviderError(
          "PROVIDER_MALFORMED",
          "Malformed allocation response",
          { retryable: false }
        );
      }
      return {
        id,
        phoneNumber: phoneNumber.startsWith("+")
          ? phoneNumber
          : `+${phoneNumber}`,
        status: "WAITING" as const,
      };
    }

    this.interpretErrorBody(body);
  }

  async getStatus(activationId: string) {
    if (!activationId || activationId.length > 120) {
      throw new SmsProviderError(
        "PROVIDER_REJECTED",
        "Invalid activation reference",
        { retryable: false }
      );
    }
    const body = await this.request({
      action: "getStatus",
      id: activationId,
    });
    try {
      const mapped = mapProviderStatusText(body);
      return {
        id: activationId,
        status: mapped.status,
        code: mapped.code,
      };
    } catch {
      if (
        body.toUpperCase().includes("NO_ACTIVATION") ||
        body.toUpperCase().includes("ERROR")
      ) {
        this.interpretErrorBody(body);
      }
      throw new SmsProviderError(
        "PROVIDER_MALFORMED",
        "Malformed status response",
        { retryable: false }
      );
    }
  }

  async cancelActivation(activationId: string) {
    if (!activationId) {
      throw new SmsProviderError(
        "PROVIDER_REJECTED",
        "Invalid activation reference",
        { retryable: false }
      );
    }
    // status=8 → cancel
    const body = await this.request({
      action: "setStatus",
      id: activationId,
      status: 8,
    });
    if (
      body === "ACCESS_CANCEL" ||
      body === "ACCESS_READY" ||
      body.startsWith("ACCESS_")
    ) {
      return;
    }
    // Already cancelled / finished is treated as success for idempotent cleanup
    if (
      body.toUpperCase().includes("NO_ACTIVATION") ||
      body.toUpperCase().includes("EARLY_CANCEL_DENIED")
    ) {
      return;
    }
    throw new SmsProviderError(
      "PROVIDER_CANCEL_FAILED",
      "Provider cancel rejected",
      { retryable: true }
    );
  }

  /** Mark activation complete at provider (status=6) after code received. */
  async completeActivation(activationId: string) {
    const body = await this.request({
      action: "setStatus",
      id: activationId,
      status: 6,
    });
    if (body.startsWith("ACCESS_") || body.toUpperCase().includes("OK")) {
      return;
    }
    // Non-fatal for our lifecycle — code already captured
  }

  /** Test helper — exposes redaction without leaking keys. */
  static redactForTests(url: string) {
    return redactUrl(url);
  }
}
