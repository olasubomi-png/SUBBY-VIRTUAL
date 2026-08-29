/**
 * Normalized SMS catalog + bounded pricing cache.
 * Mock: static catalog. External: live provider prices, fail closed.
 */
import type { SMSProvider } from "./domain";
import type { SmsProviderConfig, RuntimeEnv } from "./smsProviderConfig";
import { resolveSmsProviderConfig } from "./smsProviderConfig";
import {
  applyMarkupBps,
  computeRetailFromProviderMajor,
  parseFxMinorPerProviderMajor,
  parseMarkupBps,
  type WalletCurrency,
} from "./smsPricing";
import {
  ISO_TO_PROVIDER_COUNTRY,
  PROVIDER_SERVICE_LABELS,
  SERVICE_TO_PROVIDER_CODE,
  mapCountryToProviderId,
  mapServiceToProviderCode,
} from "./smsProviderMapping";
import { SmsProviderError } from "./smsProviderErrors";
import { resolveCountryName } from "./countryNames";

export const CATALOG_CACHE_TTL_MS = 60_000; // 60s bounded cache

export type NormalizedCatalogEntry = {
  countryCode: string;
  countryName: string;
  serviceId: string;
  serviceName: string;
  available: boolean;
  count: number;
  providerCostMinor: number;
  retailPriceMinor: number;
  currency: WalletCurrency;
  providerCountryId?: number;
  providerServiceCode?: string;
};

/** Client-safe catalog entry (no provider cost). */
export type PublicCatalogEntry = {
  countryCode: string;
  countryName: string;
  serviceId: string;
  serviceName: string;
  available: boolean;
  count: number;
  retailPriceMinor: number;
  currency: WalletCurrency;
};

export type CatalogSnapshot = {
  version: string;
  fetchedAt: number;
  mode: "mock" | "external";
  entries: NormalizedCatalogEntry[];
  currency: WalletCurrency;
  markupBps: number;
};

export type PriceQuote = {
  countryCode: string;
  serviceId: string;
  retailPriceMinor: number;
  providerCostMinor: number;
  currency: WalletCurrency;
  pricingVersion: string;
  available: boolean;
};

type CacheEntry = {
  snapshot: CatalogSnapshot;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

const REVERSE_COUNTRY: Record<number, string> = Object.fromEntries(
  Object.entries(ISO_TO_PROVIDER_COUNTRY)
    .filter(([iso]) => iso.length === 2)
    .map(([iso, id]) => [id, iso])
);

const REVERSE_SERVICE: Record<string, string> = Object.fromEntries(
  Object.entries(SERVICE_TO_PROVIDER_CODE).map(([id, code]) => [code, id])
);

function cacheKey(mode: string, baseUrl?: string): string {
  return mode === "mock" ? "mock" : `external:${baseUrl ?? ""}`;
}

export function clearSmsCatalogCache() {
  cache.clear();
}

export function toPublicCatalog(entries: NormalizedCatalogEntry[]): PublicCatalogEntry[] {
  return entries.map(e => ({
    countryCode: e.countryCode,
    countryName: e.countryName,
    serviceId: e.serviceId,
    serviceName: e.serviceName,
    available: e.available,
    count: e.count,
    retailPriceMinor: e.retailPriceMinor,
    currency: e.currency,
  }));
}

function mockCatalog(markupBps: number): CatalogSnapshot {
  // Mock provider costs in NGN kobo (integer). Retail = cost + markup.
  const pricing: Array<{ serviceId: string; amount: number }> = [
    { serviceId: "verify", amount: 25_000 },
    { serviceId: "whatsapp", amount: 30_000 },
    { serviceId: "telegram", amount: 22_000 },
    { serviceId: "google", amount: 35_000 },
    { serviceId: "facebook", amount: 28_000 },
    { serviceId: "instagram", amount: 28_000 },
    { serviceId: "tiktok", amount: 32_000 },
    { serviceId: "twitter", amount: 30_000 },
    { serviceId: "discord", amount: 20_000 },
    { serviceId: "uber", amount: 40_000 },
    { serviceId: "amazon", amount: 33_000 },
    { serviceId: "sandbox", amount: 15_000 },
  ];
  const countries = [
    { code: "NG", name: "Nigeria" },
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
    { code: "CA", name: "Canada" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "IN", name: "India" },
    { code: "KE", name: "Kenya" },
    { code: "GH", name: "Ghana" },
    { code: "ZA", name: "South Africa" },
  ];
  const entries: NormalizedCatalogEntry[] = [];
  for (const country of countries) {
    for (const price of pricing) {
      const cost = price.amount;
      const retail = markupBps > 0 ? applyMarkupBps(cost, markupBps) : cost;
      entries.push({
        countryCode: country.code,
        countryName: country.name,
        serviceId: price.serviceId,
        serviceName:
          PROVIDER_SERVICE_LABELS[SERVICE_TO_PROVIDER_CODE[price.serviceId] ?? ""] ??
          price.serviceId,
        available: true,
        count: 50_000,
        providerCostMinor: cost,
        retailPriceMinor: retail,
        currency: "NGN",
        providerCountryId: ISO_TO_PROVIDER_COUNTRY[country.code],
        providerServiceCode: SERVICE_TO_PROVIDER_CODE[price.serviceId],
      });
    }
  }
  const version = `sms-live-v1-mock-${entries.length}-m${markupBps}`;
  return {
    version,
    fetchedAt: Date.now(),
    mode: "mock",
    entries,
    currency: "NGN",
    markupBps,
  };
}

type LivePriceRow = {
  countryId: number;
  serviceCode: string;
  cost: unknown;
  count: number;
};

/**
 * Parse SMS-Activate getPrices JSON into rows.
 * Shape: { "19": { "wa": { "cost": 12, "count": 10 }, ... }, ... }
 */
export function parseProviderPricesJson(raw: string): LivePriceRow[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new SmsProviderError(
      "PROVIDER_MALFORMED",
      "Malformed provider price catalog",
      { retryable: false }
    );
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new SmsProviderError(
      "PROVIDER_MALFORMED",
      "Malformed provider price catalog",
      { retryable: false }
    );
  }
  const rows: LivePriceRow[] = [];
  for (const [countryKey, services] of Object.entries(
    data as Record<string, unknown>
  )) {
    const countryId = Number(countryKey);
    if (!Number.isInteger(countryId)) continue;
    if (!services || typeof services !== "object" || Array.isArray(services)) {
      continue;
    }
    for (const [serviceCode, info] of Object.entries(
      services as Record<string, unknown>
    )) {
      if (!info || typeof info !== "object") continue;
      const record = info as Record<string, unknown>;
      const count = Number(record.count ?? 0);
      rows.push({
        countryId,
        serviceCode,
        cost: record.cost,
        count: Number.isFinite(count) ? count : 0,
      });
    }
  }
  if (rows.length === 0) {
    throw new SmsProviderError(
      "PROVIDER_MALFORMED",
      "Empty provider price catalog",
      { retryable: true }
    );
  }
  return rows;
}

export async function buildExternalCatalog(
  provider: SMSProvider & {
    fetchPricesJson?: () => Promise<string>;
  },
  env: RuntimeEnv
): Promise<CatalogSnapshot> {
  const markupBps = parseMarkupBps(env.SMS_MARKUP_BPS);
  const fx = parseFxMinorPerProviderMajor(env.SMS_FX_MINOR_PER_PROVIDER_MAJOR);
  if (typeof provider.fetchPricesJson !== "function") {
    throw new SmsProviderError(
      "PROVIDER_NOT_IMPLEMENTED",
      "External provider does not support live pricing",
      { retryable: false }
    );
  }
  const raw = await provider.fetchPricesJson();
  const rows = parseProviderPricesJson(raw);
  const entries: NormalizedCatalogEntry[] = [];
  for (const row of rows) {
    const countryCode = REVERSE_COUNTRY[row.countryId];
    const serviceId = REVERSE_SERVICE[row.serviceCode];
    if (!countryCode || !serviceId) continue; // skip unmapped provider rows
    let providerCostMinor: number;
    try {
      ({ providerCostMinor } = computeRetailFromProviderMajor(
        row.cost,
        fx,
        markupBps
      ));
    } catch {
      continue; // skip invalid price rows
    }
    // Customer retail = provider cost + configured markup (integer ceil)
    const retailPriceMinor = applyMarkupBps(providerCostMinor, markupBps);
    entries.push({
      countryCode,
      countryName: resolveCountryName(countryCode),
      serviceId,
      serviceName: PROVIDER_SERVICE_LABELS[row.serviceCode] ?? serviceId,
      available: row.count > 0,
      providerCostMinor,
      retailPriceMinor,
      currency: "NGN",
      providerCountryId: row.countryId,
      providerServiceCode: row.serviceCode,
    });
  }
  if (entries.length === 0) {
    throw new SmsProviderError(
      "PROVIDER_MALFORMED",
      "No mappable catalog entries from provider",
      { retryable: true }
    );
  }
  const version = `sms-live-v1-ext-${entries.length}-m${markupBps}-${fx}`;
  return {
    version,
    fetchedAt: Date.now(),
    mode: "external",
    entries,
    currency: "NGN",
    markupBps,
  };
}

export async function getCatalogSnapshot(
  provider: SMSProvider,
  env: RuntimeEnv = process.env,
  options?: { forceRefresh?: boolean }
): Promise<CatalogSnapshot> {
  const config = resolveSmsProviderConfig(env);
  const key = cacheKey(
    config.mode,
    config.mode === "external" ? config.baseUrl : undefined
  );
  const now = Date.now();
  if (!options?.forceRefresh) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.snapshot;
    }
  }
  const markupBps = parseMarkupBps(env.SMS_MARKUP_BPS);
  let snapshot: CatalogSnapshot;
  if (config.mode === "mock") {
    snapshot = mockCatalog(markupBps);
  } else {
    snapshot = await buildExternalCatalog(
      provider as SMSProvider & { fetchPricesJson?: () => Promise<string> },
      env
    );
  }
  cache.set(key, {
    snapshot,
    expiresAt: now + CATALOG_CACHE_TTL_MS,
  });
  return snapshot;
}

export async function resolvePriceQuote(
  provider: SMSProvider,
  countryCode: string,
  serviceId: string,
  env: RuntimeEnv = process.env
): Promise<PriceQuote> {
  const snapshot = await getCatalogSnapshot(provider, env);
  const entry = snapshot.entries.find(
    e =>
      e.countryCode === countryCode &&
      e.serviceId === serviceId &&
      e.available
  );
  if (!entry) {
    // Distinguish unknown vs unavailable
    const any = snapshot.entries.find(
      e => e.countryCode === countryCode && e.serviceId === serviceId
    );
    if (!any) {
      try {
        mapCountryToProviderId(countryCode);
        mapServiceToProviderCode(serviceId);
      } catch {
        throw new Error("Unknown SMS country or service");
      }
      throw new Error("Service not available for country");
    }
    throw new Error("Service not available for country");
  }
  if (
    !Number.isSafeInteger(entry.retailPriceMinor) ||
    entry.retailPriceMinor <= 0
  ) {
    throw new Error("Invalid retail price");
  }
  return {
    countryCode: entry.countryCode,
    serviceId: entry.serviceId,
    retailPriceMinor: entry.retailPriceMinor,
    providerCostMinor: entry.providerCostMinor,
    currency: entry.currency,
    pricingVersion: snapshot.version,
    available: entry.available,
  };
}

export function getCatalogCacheStatus(env: RuntimeEnv = process.env) {
  const config = resolveSmsProviderConfig(env);
  const key = cacheKey(
    config.mode,
    config.mode === "external" ? config.baseUrl : undefined
  );
  const hit = cache.get(key);
  if (!hit) {
    return {
      mode: config.mode,
      cached: false,
      expiresAt: null as number | null,
      version: null as string | null,
      entryCount: 0,
      countryCount: 0,
      serviceCount: 0,
    };
  }
  const countries = new Set(hit.snapshot.entries.map(e => e.countryCode));
  const services = new Set(hit.snapshot.entries.map(e => e.serviceId));
  return {
    mode: config.mode,
    cached: true,
    expiresAt: hit.expiresAt,
    version: hit.snapshot.version,
    entryCount: hit.snapshot.entries.length,
    countryCount: countries.size,
    serviceCount: services.size,
    fetchedAt: hit.snapshot.fetchedAt,
    markupBps: hit.snapshot.markupBps,
  };
}
