import { useMemo, useState } from "react";
import { Search, RefreshCw, ChevronRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  countryFlagEmoji,
  formatAvailabilityCount,
  formatNgnFromKobo,
} from "@/lib/countryFlag";
import { trpc } from "@/lib/trpc";

type CatalogEntry = {
  countryCode: string;
  countryName: string;
  serviceId: string;
  serviceName: string;
  available: boolean;
  count: number | null | undefined;
  retailPriceMinor: number;
  currency: string;
};

type Props = {
  onOrdered: (id: string) => void;
  onFeedback: (msg: string) => void;
};

const POPULAR_SERVICE_IDS = [
  "whatsapp",
  "facebook",
  "instagram",
  "telegram",
  "google",
  "tiktok",
  "twitter",
];

const PAGE_SIZE = 40;

function serviceInitial(name: string) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

function isAvailable(e: CatalogEntry): boolean {
  return (
    e.available === true &&
    typeof e.count === "number" &&
    Number.isFinite(e.count) &&
    e.count > 0
  );
}

function isUnavailable(e: CatalogEntry): boolean {
  if (typeof e.count === "number" && Number.isFinite(e.count) && e.count <= 0) {
    return true;
  }
  return e.available === false && typeof e.count === "number";
}

function availabilityLabel(e: CatalogEntry): string {
  if (isAvailable(e)) return formatAvailabilityCount(e.count as number);
  if (isUnavailable(e)) return "Unavailable";
  return "Checking availability";
}

function UpdatedLabel({ iso }: { iso?: string }) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 5_000) return <span>Updated just now</span>;
  if (ms < 60_000) return <span>Updated {Math.floor(ms / 1000)}s ago</span>;
  return <span>Updated {Math.floor(ms / 60_000)}m ago</span>;
}

export function SmsMarketplace({ onOrdered, onFeedback }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"available" | "popular" | "all">(
    "available"
  );
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const wallet = trpc.workspace.wallet.useQuery();
  const smsOptions = trpc.workspace.smsOptions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const smsQuote = trpc.workspace.smsQuote.useQuery(
    {
      country: selected?.countryCode ?? "",
      serviceId: selected?.serviceId ?? "",
    },
    { enabled: Boolean(selected?.countryCode && selected?.serviceId) }
  );
  const createSms = trpc.workspace.createSmsRequest.useMutation({
    onSuccess: data => {
      onFeedback("Number allocated successfully.");
      onOrdered(data.id);
      setSelected(null);
      void smsOptions.refetch();
      void wallet.refetch();
    },
    onError: err => onFeedback(err.message || "Unable to allocate number"),
  });

  const entries: CatalogEntry[] = useMemo(() => {
    const raw =
      (smsOptions.data as { entries?: CatalogEntry[] } | undefined)?.entries ??
      [];
    if (raw.length > 0) return raw;
    const pricing = smsOptions.data?.pricing ?? [];
    return pricing.map(p => {
      const row = p as {
        serviceId: string;
        countryCode: string;
        amount: number;
        available?: boolean;
        count?: number;
        serviceName?: string;
        countryName?: string;
      };
      return {
        serviceId: row.serviceId,
        countryCode: row.countryCode,
        retailPriceMinor: row.amount,
        available: row.available !== false,
        count: row.count,
        serviceName:
          row.serviceName ??
          smsOptions.data?.services.find(s => s.id === row.serviceId)?.name ??
          row.serviceId,
        countryName:
          row.countryName ??
          smsOptions.data?.countries.find(c => c.code === row.countryCode)
            ?.name ??
          row.countryCode,
        currency: "NGN",
      };
    });
  }, [smsOptions.data]);

  const countries = useMemo(() => {
    const map = new Map<string, { code: string; name: string; stock: number }>();
    for (const e of entries) {
      if (!isAvailable(e)) continue;
      const cur = map.get(e.countryCode);
      if (!cur) {
        map.set(e.countryCode, {
          code: e.countryCode,
          name: e.countryName,
          stock: e.count as number,
        });
      } else {
        cur.stock += e.count as number;
      }
    }
    return [...map.values()].sort((a, b) => b.stock - a.stock);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries;

    if (countryFilter) {
      list = list.filter(e => e.countryCode === countryFilter);
    }

    if (filter === "available") {
      list = list.filter(isAvailable);
    } else if (filter === "popular") {
      list = list.filter(
        e => POPULAR_SERVICE_IDS.includes(e.serviceId) && isAvailable(e)
      );
      if (list.length === 0) list = entries.filter(isAvailable);
    }

    if (q) {
      list = list.filter(
        e =>
          e.serviceName.toLowerCase().includes(q) ||
          e.serviceId.toLowerCase().includes(q) ||
          e.countryName.toLowerCase().includes(q) ||
          e.countryCode.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const av = Number(isAvailable(b)) - Number(isAvailable(a));
      if (av !== 0) return av;
      const countDiff = (Number(b.count) || 0) - (Number(a.count) || 0);
      if (countDiff !== 0) return countDiff;
      return a.serviceName.localeCompare(b.serviceName);
    });
  }, [entries, search, filter, countryFilter]);

  const shown = filtered.slice(0, visible);
  const balancePoints = wallet.data?.balanceMinor ?? 0;
  const healthOk =
    !smsOptions.isError && (entries.length > 0 || smsOptions.isLoading);

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      {/* Header */}
      <header className="min-w-0 space-y-3 rounded-2xl border border-white/[0.07] bg-[#0d1210] p-3.5 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
              SMS Activations
            </p>
            <p className="text-sm leading-snug text-slate-400">
              Get virtual numbers for verification.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Balance
            </p>
            <p className="text-sm font-semibold tabular-nums text-amber-400">
              {balancePoints.toLocaleString("en-US")} pts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              healthOk ? "bg-emerald-400" : "bg-amber-400"
            )}
          />
          <span className="truncate">
            {healthOk ? "All systems operational" : "Catalog unavailable"}
            {" · "}
            <UpdatedLabel
              iso={
                (smsOptions.data as { refreshedAt?: string } | undefined)
                  ?.refreshedAt
              }
            />
          </span>
          <button
            type="button"
            className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-emerald-400"
            disabled={smsOptions.isFetching}
            onClick={() => void smsOptions.refetch()}
            aria-label="Refresh catalog"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", smsOptions.isFetching && "animate-spin")}
            />
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-0 w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search services or countries…"
            className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#0a0e0b] pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
          />
        </div>

        {/* Filters */}
        <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["available", "Available"],
              ["popular", "Popular"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFilter(id);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                "h-9 shrink-0 rounded-full px-3.5 text-xs font-medium transition",
                filter === id
                  ? "border border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
                  : "border border-white/10 text-slate-400 hover:text-slate-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Country chips */}
        {countries.length > 0 && (
          <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => {
                setCountryFilter(null);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                "h-9 shrink-0 rounded-full px-3 text-xs transition",
                countryFilter === null
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border border-white/10 text-slate-400"
              )}
            >
              All countries
            </button>
            {countries.slice(0, 24).map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCountryFilter(c.code === countryFilter ? null : c.code);
                  setVisible(PAGE_SIZE);
                }}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3 text-xs transition",
                  countryFilter === c.code
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border border-white/10 text-slate-400"
                )}
              >
                {countryFlagEmoji(c.code)} {c.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Loading */}
      {smsOptions.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
            />
          ))}
        </div>
      )}

      {smsOptions.isError && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-8 text-center">
          <p className="text-sm text-amber-200/90">
            Unable to load live availability.
          </p>
          <p className="mt-1 text-xs text-slate-500">Please try again shortly.</p>
          <Button
            className="mt-4 h-11"
            variant="outline"
            onClick={() => void smsOptions.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Rows */}
      {!smsOptions.isLoading && !smsOptions.isError && (
        <div className="min-w-0 space-y-1.5">
          {shown.length === 0 && (
            <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-sm text-slate-500">
              No numbers currently available for this filter.
            </div>
          )}
          {shown.map(entry => {
            const available = isAvailable(entry);
            const unavailable = isUnavailable(entry);
            return (
              <button
                key={`${entry.serviceId}-${entry.countryCode}`}
                type="button"
                disabled={unavailable}
                onClick={() => available && setSelected(entry)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#0d1210] px-3 py-2.5 text-left transition sm:gap-3 sm:px-3.5 sm:py-3",
                  unavailable
                    ? "cursor-not-allowed opacity-45"
                    : "hover:border-emerald-500/25 hover:bg-[#121a15] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/50"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-sm font-semibold text-emerald-400">
                  {serviceInitial(entry.serviceName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {entry.serviceName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    <span>
                      {countryFlagEmoji(entry.countryCode)} {entry.countryName}
                    </span>
                    <span className="mx-1.5 text-slate-700">·</span>
                    <span
                      className={cn(
                        available
                          ? "text-emerald-400/90"
                          : unavailable
                            ? "text-slate-600"
                            : "text-amber-400/80"
                      )}
                    >
                      {availabilityLabel(entry)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-sm font-semibold tabular-nums text-amber-400">
                    {formatNgnFromKobo(entry.retailPriceMinor)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>
              </button>
            );
          })}
          {filtered.length > visible && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setVisible(v => v + PAGE_SIZE)}
            >
              Show more ({filtered.length - visible} remaining)
            </Button>
          )}
        </div>
      )}

      {/* Confirm sheet */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <div className="relative z-10 w-full max-w-md min-w-0 rounded-t-2xl border border-white/10 bg-[#0d1210] p-4 sm:rounded-2xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-base font-semibold text-emerald-400">
                  {serviceInitial(selected.serviceName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-100">
                    {selected.serviceName}
                  </p>
                  <p className="truncate text-sm text-slate-400">
                    {countryFlagEmoji(selected.countryCode)}{" "}
                    {selected.countryName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Price
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-amber-400">
                  {formatNgnFromKobo(selected.retailPriceMinor)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Availability
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm font-medium",
                    isAvailable(selected)
                      ? "text-emerald-400"
                      : "text-slate-400"
                  )}
                >
                  {availabilityLabel(selected)}
                </p>
              </div>
            </div>

            {smsQuote.data && (
              <div className="mt-2.5 space-y-1.5 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs">
                <div className="flex justify-between gap-2 text-slate-400">
                  <span>Provider cost</span>
                  <span className="tabular-nums text-slate-300">
                    {formatNgnFromKobo(smsQuote.data.providerCostMinor)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-slate-400">
                  <span>SUBBY markup ({(smsQuote.data.markupBps / 100).toFixed(0)}%)</span>
                  <span className="tabular-nums text-slate-300">
                    {formatNgnFromKobo(smsQuote.data.markupAmountMinor)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5 font-medium text-slate-200">
                  <span>Final price</span>
                  <span className="tabular-nums text-amber-400">
                    {formatNgnFromKobo(smsQuote.data.retailPriceMinor)}
                    <span className="ml-1 font-normal text-slate-500">
                      · {smsQuote.data.pointsRequired} pts
                    </span>
                  </span>
                </div>
              </div>
            )}
            <div className="mt-2.5 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Your balance
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-400">
                {balancePoints.toLocaleString("en-US")} points
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              <Button
                className="h-12 flex-1 bg-emerald-500 text-[#052e16] hover:bg-emerald-400"
                disabled={createSms.isPending || !isAvailable(selected)}
                onClick={() => {
                  createSms.mutate({
                    country: selected.countryCode,
                    serviceId: selected.serviceId,
                    idempotencyKey: crypto.randomUUID(),
                  });
                }}
              >
                {createSms.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Allocating…
                  </>
                ) : (
                  "Confirm purchase"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
