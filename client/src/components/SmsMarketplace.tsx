import { useMemo, useState } from "react";
import { Search, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
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
  count: number;
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

function serviceInitial(name: string) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

function UpdatedLabel({ iso }: { iso?: string }) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return <span>Updated just now</span>;
  if (ms < 5_000) return <span>Updated just now</span>;
  if (ms < 60_000) return <span>Updated {Math.floor(ms / 1000)}s ago</span>;
  return <span>Updated {Math.floor(ms / 60_000)}m ago</span>;
}

export function SmsMarketplace({ onOrdered, onFeedback }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"popular" | "all">("popular");
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const wallet = trpc.workspace.wallet.useQuery();
  const smsOptions = trpc.workspace.smsOptions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
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
    // Fallback from legacy pricing shape
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
        count: row.count ?? 0,
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries;
    if (filter === "popular") {
      list = list.filter(e => POPULAR_SERVICE_IDS.includes(e.serviceId));
      if (list.length === 0) list = entries;
    }
    if (!q) return list;
    return list.filter(e => {
      return (
        e.serviceName.toLowerCase().includes(q) ||
        e.serviceId.toLowerCase().includes(q) ||
        e.countryName.toLowerCase().includes(q) ||
        e.countryCode.toLowerCase().includes(q)
      );
    });
  }, [entries, search, filter]);

  // Aggregate services for top chips
  const servicesSummary = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; minPrice: number; totalCount: number }
    >();
    for (const e of entries) {
      const cur = map.get(e.serviceId);
      if (!cur) {
        map.set(e.serviceId, {
          id: e.serviceId,
          name: e.serviceName,
          minPrice: e.retailPriceMinor,
          totalCount: e.count,
        });
      } else {
        cur.minPrice = Math.min(cur.minPrice, e.retailPriceMinor);
        cur.totalCount += e.count;
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const balancePoints = wallet.data?.balanceMinor ?? 0;
  const balanceNgn = balancePoints * 500; // display: 1 point = ₦500 major

  const healthOk = !smsOptions.isError && (entries.length > 0 || smsOptions.isLoading);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-[#0c1018] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
              SMS Activations
            </p>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
              Live virtual numbers for legitimate testing and communications
              workflows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Available balance
              </p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums">
                {balancePoints.toLocaleString("en-US")} pts
                <span className="ml-1.5 text-xs font-normal text-slate-500">
                  · ₦{balanceNgn.toLocaleString("en-US")}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  healthOk ? "bg-emerald-400" : "bg-amber-400"
                )}
              />
              {healthOk ? "All systems operational" : "Catalog unavailable"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services or countries…"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0a0c12] pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("popular")}
              className={cn(
                "h-11 min-w-[5.5rem] rounded-xl px-3 text-xs font-medium transition",
                filter === "popular"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                  : "border border-white/10 text-slate-400 hover:text-slate-200"
              )}
            >
              Popular
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "h-11 min-w-[5.5rem] rounded-xl px-3 text-xs font-medium transition",
                filter === "all"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                  : "border border-white/10 text-slate-400 hover:text-slate-200"
              )}
            >
              All services
            </button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-11 shrink-0 p-0"
              disabled={smsOptions.isFetching}
              onClick={() => void smsOptions.refetch()}
              aria-label="Refresh catalog"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  smsOptions.isFetching && "animate-spin"
                )}
              />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          <UpdatedLabel
            iso={
              (smsOptions.data as { refreshedAt?: string } | undefined)
                ?.refreshedAt
            }
          />
        </p>
      </div>

      {/* Loading */}
      {smsOptions.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {smsOptions.isError && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center">
          <p className="text-sm text-amber-200/90">
            Unable to load live availability.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Please try again shortly.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void smsOptions.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Service quick chips */}
      {!smsOptions.isLoading && !smsOptions.isError && servicesSummary.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {servicesSummary.slice(0, 12).map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSearch(s.name)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-[#0c1018] px-3 py-2 text-xs text-slate-300 hover:border-cyan-500/30 hover:text-cyan-200 transition"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-semibold text-cyan-300">
                {serviceInitial(s.name)}
              </span>
              {s.name}
              <span className="text-slate-500 tabular-nums">
                {formatNgnFromKobo(s.minPrice)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Marketplace rows */}
      {!smsOptions.isLoading && !smsOptions.isError && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-sm text-slate-500">
              No numbers currently available for this search.
            </div>
          )}
          {filtered.map(entry => {
            const unavailable = !entry.available || entry.count <= 0;
            return (
              <button
                key={`${entry.serviceId}-${entry.countryCode}`}
                type="button"
                disabled={unavailable}
                onClick={() => setSelected(entry)}
                className={cn(
                  "group flex w-full min-h-[72px] items-center gap-3 rounded-xl border border-white/10 bg-[#0c1018] px-3 py-3 text-left transition sm:px-4",
                  unavailable
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:border-cyan-500/25 hover:bg-[#0e1420] active:scale-[0.995]"
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-sm font-semibold text-cyan-200">
                  {serviceInitial(entry.serviceName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {entry.serviceName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span>
                      {countryFlagEmoji(entry.countryCode)}{" "}
                      {entry.countryName}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        unavailable ? "text-slate-600" : "text-emerald-400/90"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {formatAvailabilityCount(entry.count)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {formatNgnFromKobo(entry.retailPriceMinor)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-white/10 bg-[#0c1018] p-5 sm:rounded-2xl safe-pb">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-base font-semibold text-cyan-200">
                {serviceInitial(selected.serviceName)}
              </span>
              <div>
                <p className="text-base font-semibold text-slate-100">
                  {selected.serviceName}
                </p>
                <p className="text-sm text-slate-400">
                  {countryFlagEmoji(selected.countryCode)}{" "}
                  {selected.countryName}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Price
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-100 tabular-nums">
                  {formatNgnFromKobo(selected.retailPriceMinor)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Availability
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-400/90">
                  {formatAvailabilityCount(selected.count)}
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              <Button
                className="h-12 flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                disabled={
                  createSms.isPending ||
                  !selected.available ||
                  selected.count <= 0
                }
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
                  "Get number"
                )}
              </Button>
            </div>
            {(!selected.available || selected.count <= 0) && (
              <p className="mt-3 text-center text-xs text-amber-300/90">
                No numbers currently available.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
