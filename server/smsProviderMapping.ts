/**
 * Maps between SUBBY service/country identifiers and SMS-Activate-compatible
 * provider codes, and maps provider status strings into canonical lifecycle states.
 *
 * Canonical app states remain authoritative — provider statuses are translated only.
 */
import type { SmsOrderStatus } from "./smsOrderLifecycle";

/** ISO country → SMS-Activate numeric country id (documented public mapping). */
export const ISO_TO_PROVIDER_COUNTRY: Record<string, number> = {
  RU: 0,
  UA: 1,
  KZ: 2,
  CN: 3,
  PH: 4,
  MM: 5,
  ID: 6,
  MY: 7,
  KE: 8,
  TZ: 9,
  VN: 10,
  KG: 11,
  US: 12,
  IL: 13,
  HK: 14,
  PL: 15,
  GB: 16,
  MG: 17,
  CG: 18,
  NG: 19,
  MO: 20,
  EG: 21,
  IN: 22,
  IE: 23,
  KH: 24,
  LA: 25,
  HT: 26,
  CI: 27,
  GM: 28,
  RS: 29,
  YE: 30,
  ZA: 31,
  RO: 32,
  CO: 33,
  EE: 34,
  AZ: 35,
  CA: 36,
  MA: 37,
  GH: 38,
  AR: 39,
  UZ: 40,
  CM: 41,
  TD: 42,
  DE: 43,
  LT: 44,
  HR: 45,
  SE: 46,
  IQ: 47,
  NL: 48,
  LV: 49,
  AT: 50,
  BY: 51,
  TH: 52,
  SA: 53,
  MX: 54,
  TW: 55,
  ES: 56,
  IR: 57,
  DZ: 58,
  SI: 59,
  BD: 60,
  SN: 61,
  TR: 62,
  CZ: 63,
  LK: 64,
  PE: 65,
  PK: 66,
  NZ: 67,
  GN: 68,
  ML: 69,
  VE: 70,
  ET: 71,
  MN: 72,
  BR: 73,
  AF: 74,
  UG: 75,
  AO: 76,
  CY: 77,
  FR: 78,
  PG: 79,
  MZ: 80,
  NP: 81,
  BE: 82,
  BG: 83,
  HU: 84,
  MD: 85,
  IT: 86,
  PY: 87,
  HN: 88,
  TN: 89,
  NI: 90,
  TL: 91,
  BO: 92,
  CR: 93,
  GT: 94,
  AE: 95,
  ZW: 96,
  PR: 97,
  SD: 98,
  TG: 99,
  KW: 100,
  SV: 101,
  LY: 102,
  JM: 103,
  TT: 104,
  EC: 105,
  SZ: 106,
  OM: 107,
  BA: 108,
  DO: 109,
  SY: 110,
  QA: 111,
  PA: 112,
  CU: 113,
  MR: 114,
  SL: 115,
  JO: 116,
  PT: 117,
  BB: 118,
  BI: 119,
  BJ: 120,
  BN: 121,
  BS: 122,
  BW: 123,
  BZ: 124,
  CF: 125,
  DM: 126,
  GD: 127,
  GE: 128,
  GR: 129,
  GW: 130,
  GY: 131,
  IS: 132,
  KM: 133,
  KN: 134,
  LR: 135,
  LS: 136,
  MW: 137,
  NA: 138,
  NE: 139,
  RW: 140,
  SK: 141,
  SR: 142,
  TJ: 143,
  MC: 144,
  BH: 145,
  RE: 146,
  ZM: 147,
  AM: 148,
  SO: 149,
  CD: 150,
  CL: 151,
  BF: 152,
  LB: 153,
  GA: 154,
  AL: 155,
  UY: 156,
  MU: 157,
  BT: 158,
  MV: 159,
  GP: 160,
  TM: 161,
  GF: 162,
  FI: 163,
  LC: 164,
  LU: 165,
  VC: 166,
  GQ: 167,
  DJ: 168,
  AG: 169,
  KY: 170,
  ME: 171,
  DK: 172,
  CH: 173,
  NO: 174,
  AU: 175,
  ER: 176,
  SS: 177,
  ST: 178,
  AW: 179,
  MS: 180,
  AI: 181,
  JP: 182,
  MK: 183,
  SC: 184,
  NC: 185,
  CV: 186,
  US_VIRGIN: 187,
  SG: 196,
};

/** SUBBY serviceId → SMS-Activate service short code */
export const SERVICE_TO_PROVIDER_CODE: Record<string, string> = {
  whatsapp: "wa",
  telegram: "tg",
  google: "go",
  facebook: "fb",
  instagram: "ig",
  tiktok: "lf",
  twitter: "tw",
  discord: "ds",
  uber: "ub",
  amazon: "am",
  verify: "ot",
  sandbox: "ot",
};

export const PROVIDER_SERVICE_LABELS: Record<string, string> = {
  wa: "WhatsApp",
  tg: "Telegram",
  go: "Google",
  fb: "Facebook",
  ig: "Instagram",
  lf: "TikTok",
  tw: "X / Twitter",
  ds: "Discord",
  ub: "Uber",
  am: "Amazon",
  ot: "Other / verification",
};

export function mapServiceToProviderCode(serviceId: string): string {
  const code = SERVICE_TO_PROVIDER_CODE[serviceId];
  if (!code) {
    throw new Error(`Unsupported SMS service for external provider: ${serviceId}`);
  }
  return code;
}

export function mapCountryToProviderId(countryCode: string): number {
  const id = ISO_TO_PROVIDER_COUNTRY[countryCode.toUpperCase()];
  if (id === undefined) {
    throw new Error(`Unsupported SMS country for external provider: ${countryCode}`);
  }
  return id;
}

/**
 * SMS-Activate status text → coarse provider status used by SMSProvider.getStatus.
 */
export type ProviderActivationStatus = "WAITING" | "RECEIVED" | "CANCELLED";

export function mapProviderStatusText(
  raw: string
): { status: ProviderActivationStatus; code?: string } {
  const text = raw.trim();
  if (text.startsWith("STATUS_OK:")) {
    const code = text.slice("STATUS_OK:".length).trim();
    return { status: "RECEIVED", code: code || undefined };
  }
  if (text === "STATUS_WAIT_CODE" || text === "STATUS_WAIT_RETRY" || text === "STATUS_WAIT_RESEND") {
    return { status: "WAITING" };
  }
  if (text === "STATUS_CANCEL") {
    return { status: "CANCELLED" };
  }
  // Unknown wait-like states stay WAITING rather than failing closed mid-poll
  if (text.startsWith("STATUS_")) {
    return { status: "WAITING" };
  }
  throw new Error("malformed provider status");
}

/**
 * Map provider activation status into the next allowed canonical transition target
 * (caller still validates via the state machine).
 */
export function providerStatusToCanonicalTarget(
  status: ProviderActivationStatus
): SmsOrderStatus | null {
  switch (status) {
    case "RECEIVED":
      return "code_received";
    case "CANCELLED":
      return "cancelled";
    case "WAITING":
      return null;
  }
}
