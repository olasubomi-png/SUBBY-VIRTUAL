/**
 * Normalized SMS provider errors — safe for application logic.
 * Never include API keys, secrets, or raw upstream headers/payloads.
 */

export const SMS_PROVIDER_ERROR_CODES = [
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "PROVIDER_AUTH",
  "PROVIDER_REJECTED",
  "PROVIDER_NO_NUMBERS",
  "PROVIDER_MALFORMED",
  "PROVIDER_NOT_IMPLEMENTED",
  "PROVIDER_CANCEL_FAILED",
  "PROVIDER_RATE_LIMITED",
] as const;

export type SmsProviderErrorCode = (typeof SMS_PROVIDER_ERROR_CODES)[number];

export class SmsProviderError extends Error {
  readonly code: SmsProviderErrorCode;
  readonly retryable: boolean;

  constructor(
    code: SmsProviderErrorCode,
    message: string,
    options?: { retryable?: boolean; cause?: unknown }
  ) {
    super(message);
    this.name = "SmsProviderError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Client/safe message — never leak upstream detail. */
export function safeSmsProviderClientMessage(error: unknown): string {
  if (error instanceof SmsProviderError) {
    switch (error.code) {
      case "PROVIDER_NO_NUMBERS":
        return "No numbers available for this service and country";
      case "PROVIDER_AUTH":
        return "SMS provider authentication failed";
      case "PROVIDER_TIMEOUT":
      case "PROVIDER_UNAVAILABLE":
        return "SMS provider is temporarily unavailable";
      case "PROVIDER_RATE_LIMITED":
        return "SMS provider rate limit exceeded";
      case "PROVIDER_CANCEL_FAILED":
        return "Unable to cancel the activation with the provider";
      default:
        return "Unable to complete the SMS provider request";
    }
  }
  return "Unable to complete the SMS provider request";
}
