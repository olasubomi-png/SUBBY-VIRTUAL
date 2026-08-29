import { LocalAuthCard } from "@/components/LocalAuthCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  formatDashboardDate,
  getTimeOfDayGreeting,
  getUsableDisplayName,
} from "@shared/greeting";
import { cn } from "@/lib/utils";
import { BrandLockup, BrandMark } from "@/components/Brand";
import {
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "sms", label: "SMS requests", icon: MessageSquareText },
  { id: "mail", label: "Mail inboxes", icon: Inbox },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "jobs", label: "Jobs / Activity", icon: ListTodo },
  { id: "activity", label: "Activity", icon: BarChart3 },
  { id: "transactions", label: "Transactions", icon: CircleDollarSign },
  { id: "settings", label: "Settings", icon: ShieldCheck },
  { id: "support", label: "Support", icon: Inbox },
  { id: "admin", label: "Admin console", icon: ShieldCheck },
];

function Sidebar({
  active,
  setActive,
  isAdmin,
  mobileOpen,
  setMobileOpen,
  onSignOut,
}: {
  active: string;
  setActive: (id: string) => void;
  isAdmin: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/[0.07] bg-[#0a0c12] px-5 py-6 transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-1">
          <BrandLockup />
        </div>
        <div className="mt-12 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Workspace
        </div>
        <nav className="mt-3 space-y-1">
          {nav
            .filter(item => isAdmin || item.id !== "admin")
            .map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActive(item.id);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all",
                    active === item.id
                      ? "bg-cyan-400/10 text-cyan-200 shadow-[inset_2px_0_0_#67e8f9]"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px]",
                      active === item.id
                        ? "text-cyan-300"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                  />
                  {item.label}
                  {active === item.id && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </button>
              );
            })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 to-cyan-400/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" /> Phase 1 sandbox
          </div>
          <p className="text-xs leading-5 text-slate-400">
            Requests are simulated safely. No real messages or money are sent.
          </p>
        </div>
        <button
          onClick={onSignOut}
          className="mt-5 flex items-center gap-3 px-3 py-2 text-sm text-slate-500 transition hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="absolute right-5 top-5 h-5 w-5 text-white" />
        </button>
      )}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        status === "Completed" || status === "Code received"
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          : "border-amber-300/20 bg-amber-300/10 text-amber-200"
      )}
    >
      {status}
    </Badge>
  );
}

function Overview({ setActive }: { setActive: (id: string) => void }) {
  const { user } = useAuth();
  const summary = trpc.workspace.summary.useQuery();
  const requests = trpc.workspace.smsRequests.useQuery();
  const balance = summary.data?.balance.NGN ?? 0;
  const now = new Date();
  const timeGreeting = getTimeOfDayGreeting(now);
  const displayName = getUsableDisplayName(user?.name);
  const dateLabel = formatDashboardDate(now);
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm text-slate-500">{dateLabel}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {displayName ? (
              <>
                {timeGreeting},{" "}
                <span className="text-cyan-300">{displayName}.</span>
              </>
            ) : (
              <>{timeGreeting}.</>
            )}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Here's what's happening in your communications workspace today.
          </p>
        </div>
        <Button
          onClick={() => setActive("sms")}
          className="h-11 rounded-xl bg-cyan-300 px-5 font-semibold text-slate-950 shadow-[0_0_25px_rgba(103,232,249,0.18)] hover:bg-cyan-200"
        >
          <Plus className="mr-2 h-4 w-4" /> New request
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          icon={WalletCards}
          label="Available balance"
          value={`₦${(balance / 100).toFixed(2)}`}
          detail="Server-authoritative Demo Credits"
          accent="cyan"
        />
        <Metric
          icon={MessageSquareText}
          label="Active requests"
          value={String(summary.data?.activeRequests ?? 0).padStart(2, "0")}
          detail="Live demo requests"
          accent="violet"
        />
        <Metric
          icon={ShieldCheck}
          label="Success rate"
          value={`${summary.data?.successRate ?? 0}%`}
          detail="Demo provider status"
          accent="emerald"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-white">
                Recent requests
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Your latest mock delivery activity
              </p>
            </div>
            <button
              onClick={() => setActive("activity")}
              className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
            >
              View all <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
            </button>
          </CardHeader>
          <CardContent className="space-y-1">
            {(requests.data ?? []).map((r, i) => (
              <div
                key={r.id}
                className="flex items-center gap-4 rounded-xl px-2 py-3.5 transition hover:bg-white/[0.03]"
              >
                <div
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-xl",
                    i === 0
                      ? "bg-cyan-400/10 text-cyan-300"
                      : "bg-violet-400/10 text-violet-300"
                  )}
                >
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {r.serviceId}
                    </p>
                    <span className="text-[10px] text-slate-600">
                      {r.country}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.phoneNumber} ·{" "}
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white">
              Quick actions
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Start with a safe demo flow
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              icon={MessageSquareText}
              title="Request an SMS number"
              sub="Choose a country and service"
              onClick={() => setActive("sms")}
            />
            <QuickAction
              icon={Inbox}
              title="Create a mail inbox"
              sub="Get a private demo address"
              onClick={() => setActive("mail")}
            />
            <QuickAction
              icon={CircleDollarSign}
              title="Fund your wallet"
              sub="Review your balance and ledger"
              onClick={() => setActive("wallet")}
            />
          </CardContent>
        </Card>
      </div>
      <div className="rounded-2xl border border-cyan-300/10 bg-gradient-to-r from-cyan-400/[0.08] via-indigo-400/[0.05] to-transparent p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              Built for compliant communications testing
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              SUBBY VIRTUAL uses mock providers in Phase 1. It is designed for
              legitimate testing—not bypassing security, impersonation, or
              evading verification.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setActive("settings")}
            className="rounded-lg border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Read policy
          </Button>
        </div>
      </div>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <Card className="group overflow-hidden border-white/[0.07] bg-[#10131c] shadow-none">
      <CardContent className="relative p-5">
        <div
          className={cn(
            "mb-6 grid h-9 w-9 place-items-center rounded-lg",
            accent === "cyan"
              ? "bg-cyan-300/10 text-cyan-300"
              : accent === "violet"
                ? "bg-violet-300/10 text-violet-300"
                : "bg-emerald-300/10 text-emerald-300"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {value}
        </p>
        <p
          className={cn(
            "mt-2 text-xs",
            accent === "emerald" ? "text-emerald-300" : "text-slate-500"
          )}
        >
          {detail}
        </p>
        <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-cyan-300/[0.03] blur-2xl transition group-hover:bg-cyan-300/[0.08]" />
      </CardContent>
    </Card>
  );
}
function QuickAction({
  icon: Icon,
  title,
  sub,
  onClick,
}: {
  icon: any;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]"
    >
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-cyan-300">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-600" />
    </button>
  );
}

function RequestPage({ type }: { type: "sms" | "mail" }) {
  const [label, setLabel] = useState("verification");
  const [serviceId, setServiceId] = useState("verify");
  const [country, setCountry] = useState("NG");
  const [selectedId, setSelectedId] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const smsOptions = trpc.workspace.smsOptions.useQuery(undefined, {
    enabled: type === "sms",
  });
  const smsRequests = trpc.workspace.smsRequests.useQuery();
  const mailInboxes = trpc.workspace.mailInboxes.useQuery();
  const smsDetail = trpc.workspace.smsRequestDetail.useQuery(
    { id: selectedId ?? "" },
    { enabled: type === "sms" && Boolean(selectedId) }
  );
  const mailDetail = trpc.workspace.mailInboxDetail.useQuery(
    { id: selectedId ?? "" },
    { enabled: type === "mail" && Boolean(selectedId) }
  );
  const createSms = trpc.workspace.createSmsRequest.useMutation({
    onSuccess: () => {
      setFeedback("SMS activation created successfully.");
      smsRequests.refetch();
    },
  });
  const createMail = trpc.workspace.createMailInbox.useMutation({
    onSuccess: () => {
      setFeedback("Temporary mailbox created successfully.");
      mailInboxes.refetch();
    },
  });
  const pollSms = trpc.workspace.pollSms.useMutation({
    onSuccess: () => {
      setFeedback("Checked provider for incoming SMS.");
      smsRequests.refetch();
      smsDetail.refetch();
    },
  });
  const simulateSms = trpc.workspace.simulateSms.useMutation({
    onSuccess: data => {
      setFeedback(`SMS simulation queued · job ${data.id}`);
      smsRequests.refetch();
      smsDetail.refetch();
    },
  });
  const cancelSms = trpc.workspace.cancelSms.useMutation({
    onSuccess: () => {
      setFeedback("SMS activation cancelled successfully.");
      smsRequests.refetch();
    },
  });
  const simulateEmail = trpc.workspace.simulateEmail.useMutation({
    onSuccess: data => {
      setFeedback(`Email simulation queued · job ${data.id}`);
      mailInboxes.refetch();
      mailDetail.refetch();
    },
  });
  const expireInbox = trpc.workspace.expireInbox.useMutation({
    onSuccess: () => {
      setFeedback("Temporary mailbox expired successfully.");
      mailInboxes.refetch();
    },
  });
  const items =
    type === "sms" ? (smsRequests.data ?? []) : (mailInboxes.data ?? []);
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-2 text-sm text-slate-500">
          Workspace / {type === "sms" ? "SMS requests" : "Mail inboxes"}
        </p>
        <h1 className="text-3xl font-semibold text-white">
          {type === "sms" ? "SMS requests" : "Mail inboxes"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Demo/Test only. No external provider is contacted.
        </p>
        {feedback && (
          <p className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200">
            {feedback}
          </p>
        )}
        {(smsRequests.error ||
          mailInboxes.error ||
          createSms.error ||
          createMail.error ||
          simulateSms.error ||
          simulateEmail.error ||
          cancelSms.error ||
          expireInbox.error) && (
          <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">
            Action failed:{" "}
            {
              (
                smsRequests.error ||
                mailInboxes.error ||
                createSms.error ||
                createMail.error ||
                simulateSms.error ||
                simulateEmail.error ||
                cancelSms.error ||
                expireInbox.error
              )?.message
            }
          </p>
        )}
        {selectedId && (smsDetail.isLoading || mailDetail.isLoading) && (
          <p className="mt-3 text-xs text-cyan-200">Loading request details…</p>
        )}
        {selectedId && (smsDetail.data || mailDetail.data) && (
          <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-xs text-slate-300">
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-cyan-200">
              Request detail
            </p>
            <p>
              Selected {type === "sms" ? "activation" : "inbox"}:{" "}
              <span className="font-mono text-cyan-200">{selectedId}</span>
            </p>
            <p className="mt-1">
              Created:{" "}
              {new Date(
                (smsDetail.data || mailDetail.data)?.createdAt ?? Date.now()
              ).toLocaleString()}
            </p>
            {(smsDetail.data || mailDetail.data)?.expiresAt && (
              <p className="mt-1">
                Expires:{" "}
                {new Date(
                  (smsDetail.data || mailDetail.data)?.expiresAt as string
                ).toLocaleString()}
              </p>
            )}
            <p className="mt-1">
              Server status{" "}
              <span className="font-semibold text-white">
                {(smsDetail.data || mailDetail.data)?.status}
              </span>
            </p>
          </div>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="border-cyan-300/15 bg-[#10131c] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-white">
              {type === "sms" ? "Get a demo number" : "Create a demo inbox"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {type === "sms" ? (
              <>
                <label className="block text-xs text-slate-400">
                  Country
                  <select
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0a0c12] px-3 text-sm text-slate-200"
                    disabled={!smsOptions.data?.countries?.length}
                  >
                    {smsOptions.isLoading && (
                      <option value="">Loading catalog…</option>
                    )}
                    {(smsOptions.data?.countries ?? [{ code: "NG", name: "Nigeria" }]).map(
                      item => (
                        <option key={item.code} value={item.code}>
                          {item.name} ({item.code})
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Service
                  <select
                    value={serviceId}
                    onChange={e => setServiceId(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0a0c12] px-3 text-sm text-slate-200"
                  >
                    {smsOptions.data?.services.map(service => {
                      const quote = smsOptions.data.pricing.find(
                        p =>
                          p.serviceId === service.id &&
                          (p as { countryCode?: string }).countryCode ===
                            country &&
                          (p as { available?: boolean }).available !== false
                      ) ?? smsOptions.data.pricing.find(
                        p => p.serviceId === service.id
                      );
                      return (
                      <option key={service.id} value={service.id}>
                        {service.name}
                        {quote?.amount != null
                          ? ` · ₦${(quote.amount / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                          : ""}
                      </option>
                      );
                    })}
                  </select>
                </label>
                <Button
                  disabled={createSms.isPending}
                  onClick={() =>
                    createSms.mutate({
                      country,
                      serviceId,
                      idempotencyKey: crypto.randomUUID(),
                    })
                  }
                  className="h-11 w-full rounded-lg bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200"
                >
                  {createSms.isPending ? "Creating…" : "Get demo number"}
                </Button>
              </>
            ) : (
              <>
                <label className="block text-xs text-slate-400">
                  Inbox label
                  <input
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0a0c12] px-3 text-sm text-slate-200"
                  />
                </label>
                <Button
                  disabled={createMail.isPending}
                  onClick={() => createMail.mutate({ label })}
                  className="h-11 w-full rounded-lg bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200"
                >
                  {createMail.isPending ? "Creating…" : "Create demo inbox"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-white">
              {type === "sms" ? "Your activations" : "Your demo inboxes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No demo records yet.</p>
            ) : (
              items.map((item: any) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border border-white/[0.06] p-4",
                    selectedId === item.id &&
                      "border-cyan-300/30 bg-cyan-300/[0.03]"
                  )}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
                      {type === "sms" ? (
                        <MessageSquareText className="h-4 w-4" />
                      ) : (
                        <Inbox className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">
                        {type === "sms" ? item.phoneNumber : item.address}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {type === "sms"
                          ? `${item.serviceId} · ${item.country}`
                          : `${item.messages?.length ?? 0} messages`}{" "}
                        · Demo/Test
                      </p>
                    </div>
                    <StatusPill
                      status={
                        item.status === "COMPLETED" ? "Completed" : "Active"
                      }
                    />
                  </div>
                  {type === "sms" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={pollSms.isPending}
                        onClick={() => pollSms.mutate({ id: item.id })}
                        className="h-9 rounded-lg border border-white/10 px-3 text-xs text-slate-200"
                      >
                        {pollSms.isPending ? "Checking…" : "Check SMS"}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={simulateSms.isPending}
                        onClick={() => simulateSms.mutate({ id: item.id })}
                      >
                        {simulateSms.isPending ? "Queueing…" : "Simulate SMS"}
                      </Button>
                      {item.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          className="border-white/10 bg-transparent text-xs text-slate-300"
                          onClick={() => cancelSms.mutate({ id: item.id })}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                  {type === "mail" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="border-white/10 bg-transparent text-xs text-slate-300"
                        disabled={simulateEmail.isPending}
                        onClick={() => simulateEmail.mutate({ id: item.id })}
                      >
                        {simulateEmail.isPending
                          ? "Queueing…"
                          : "Simulate email"}
                      </Button>
                      {item.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          className="border-white/10 bg-transparent text-xs text-slate-300"
                          onClick={() => expireInbox.mutate({ id: item.id })}
                        >
                          Expire inbox
                        </Button>
                      )}
                    </div>
                  )}
                  {item.message && (
                    <p className="mt-3 rounded-lg bg-emerald-400/10 p-3 text-xs text-emerald-200">
                      {item.message.body}
                    </p>
                  )}
                  {item.messages?.map((message: any) => (
                    <p
                      key={message.receivedAt}
                      className="mt-3 rounded-lg bg-emerald-400/10 p-3 text-xs text-emerald-200"
                    >
                      {message.subject}: {message.body}
                    </p>
                  ))}
                  {type === "mail" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        className="border-white/10 bg-transparent text-xs text-slate-300"
                        onClick={() =>
                          navigator.clipboard.writeText(item.address)
                        }
                      >
                        Copy address
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-transparent text-xs text-slate-300"
                        onClick={() => mailInboxes.refetch()}
                      >
                        Refresh
                      </Button>
                      <span className="text-[11px] text-slate-500">
                        Expires {new Date(item.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Transactions() {
  const wallet = trpc.workspace.wallet.useQuery();
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-2 text-sm text-slate-500">Workspace / Transactions</p>
        <h1 className="text-3xl font-semibold text-white">Transactions</h1>
        <p className="mt-2 text-sm text-slate-400">
          A traceable view of wallet activity and request charges.
        </p>
      </div>
      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Transaction history
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Every entry carries a unique reference for support review.
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/[0.06]">
            {wallet.data?.ledger.length ? (
              wallet.data.ledger.map(entry => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 py-4"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">
                      {entry.description}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-600">
                      {entry.referenceId}
                    </p>
                  </div>
                  <StatusPill status="Completed" />
                  <p
                    className={cn(
                      "w-full text-right text-sm font-semibold sm:w-auto",
                      entry.type === "CREDIT"
                        ? "text-emerald-300"
                        : "text-slate-300"
                    )}
                  >
                    {entry.type === "CREDIT" || entry.type === "REFUND"
                      ? "+"
                      : "−"}
                    {(entry.points ?? entry.amountMinor).toLocaleString()} pts
                  </p>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-500">
                No transactions yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LegacyTransactions() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-2 text-sm text-slate-500">Workspace / Transactions</p>
        <h1 className="text-3xl font-semibold text-white">Transactions</h1>
        <p className="mt-2 text-sm text-slate-400">
          A traceable view of wallet activity and request charges.
        </p>
      </div>
      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Transaction history
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Every entry carries a unique reference for support review.
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/[0.06]">
            {[
              ["TX-2026-081", "Wallet top-up", "Completed", "+₦8,000.00"],
              ["TX-2026-080", "Account verification", "Completed", "−₦150.00"],
              ["TX-2026-079", "Sandbox testing", "Completed", "−₦80.00"],
            ].map(([ref, label, status, amount]) => (
              <div key={ref} className="flex flex-wrap items-center gap-3 py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{label}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-600">
                    {ref}
                  </p>
                </div>
                <StatusPill status={status} />
                <p className="w-full text-right text-sm font-semibold text-slate-300 sm:w-auto">
                  {amount}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function jobTypeLabel(jobType: string) {
  return jobType
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function jobStatusClass(status: string) {
  if (status === "COMPLETED") return "text-emerald-300 bg-emerald-300/10";
  if (status === "FAILED") return "text-rose-200 bg-rose-300/10";
  if (status === "CANCELLED") return "text-slate-400 bg-slate-400/10";
  if (status === "PROCESSING") return "text-cyan-200 bg-cyan-300/10";
  return "text-amber-200 bg-amber-300/10";
}

function Jobs() {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const jobs = trpc.workspace.jobs.list.useQuery(
    { page, pageSize: 10 },
    { refetchInterval: 5000 }
  );
  const detail = trpc.workspace.jobs.detail.useQuery(
    { id: selectedId ?? "" },
    { enabled: selectedId !== null, refetchInterval: 5000 }
  );
  const activity = trpc.workspace.jobs.activity.useQuery(
    { id: selectedId ?? "", limit: 50 },
    { enabled: selectedId !== null, refetchInterval: 5000 }
  );
  const smsRequests = trpc.workspace.smsRequests.useQuery();
  const mailInboxes = trpc.workspace.mailInboxes.useQuery();
  const utils = trpc.useUtils();
  const createJob = trpc.workspace.jobs.create.useMutation({
    onSuccess: result => {
      setSelectedId(result.id);
      void utils.workspace.jobs.list.invalidate();
    },
  });
  const cancelJob = trpc.workspace.jobs.cancel.useMutation({
    onSuccess: result => {
      setSelectedId(result.id);
      void utils.workspace.jobs.list.invalidate();
      void utils.workspace.jobs.detail.invalidate({ id: result.id });
      void utils.workspace.jobs.activity.invalidate({ id: result.id });
    },
  });

  const queueJob = (
    jobType: "MOCK_SMS_DELIVERY" | "DEMO_EMAIL_SIMULATION",
    resourceId: string
  ) => {
    createJob.mutate({
      requestId: crypto.randomUUID(),
      jobType,
      payload:
        jobType === "MOCK_SMS_DELIVERY"
          ? { activationId: resourceId }
          : { inboxId: resourceId },
      maxAttempts: 3,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm text-slate-500">Workspace / Jobs</p>
          <h1 className="text-3xl font-semibold text-white">Jobs / Activity</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Queue safe mock workflows and follow their server-authoritative
            lifecycle without refreshing the application.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="h-3.5 w-3.5" />
          Refreshes every 5 seconds
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Queue a mock SMS delivery
            </CardTitle>
            <p className="text-xs text-slate-500">
              Only existing owned activations can be queued.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {smsRequests.data?.filter(
              item => item.status === "ACTIVE" || item.status === "WAITING"
            ).length ? (
              smsRequests.data
                .filter(
                  item => item.status === "ACTIVE" || item.status === "WAITING"
                )
                .slice(0, 5)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-200">
                        {item.serviceId} · {item.country}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.id}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={createJob.isPending}
                      onClick={() => queueJob("MOCK_SMS_DELIVERY", item.id)}
                      className="shrink-0 bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                    >
                      Queue
                    </Button>
                  </div>
                ))
            ) : (
              <p className="py-4 text-sm text-slate-500">
                Create an eligible mock SMS request first.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Queue a demo email simulation
            </CardTitle>
            <p className="text-xs text-slate-500">
              The worker validates inbox ownership and state before delivery.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {mailInboxes.data?.filter(item => item.status === "ACTIVE")
              .length ? (
              mailInboxes.data
                .filter(item => item.status === "ACTIVE")
                .slice(0, 5)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-200">
                        {item.address}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.id}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={createJob.isPending}
                      onClick={() => queueJob("DEMO_EMAIL_SIMULATION", item.id)}
                      className="shrink-0 bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                    >
                      Queue
                    </Button>
                  </div>
                ))
            ) : (
              <p className="py-4 text-sm text-slate-500">
                Create an active mock inbox first.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {createJob.error && (
        <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">
          {createJob.error.message}
        </p>
      )}
      {cancelJob.error && (
        <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">
          {cancelJob.error.message}
        </p>
      )}

      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-white">Your jobs</CardTitle>
          <p className="text-xs text-slate-500">
            Fallback mode is explicitly in-memory; PostgreSQL mode preserves job
            history across restarts.
          </p>
        </CardHeader>
        <CardContent>
          {jobs.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading jobs…
            </p>
          ) : jobs.error ? (
            <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">
              {jobs.error.message}
            </p>
          ) : jobs.data?.items.length ? (
            <div className="space-y-2">
              {jobs.data.items.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {jobTypeLabel(job.jobType)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.id} · {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${jobStatusClass(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-cyan-300 transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      {job.progress}% · {job.attemptCount}/{job.maxAttempts}
                    </span>
                  </div>
                  {job.error && (
                    <p className="mt-3 text-xs text-rose-200">
                      {job.error.code}: {job.error.message}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No jobs have been queued yet.
            </p>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-slate-500">
            <span>
              {jobs.data?.total ?? 0} total job
              {jobs.data?.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-3">
              <span>
                Page {(jobs.data?.page ?? page) + 1} of{" "}
                {Math.max(jobs.data?.totalPages ?? 0, 1)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(current => current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= (jobs.data?.totalPages ?? 0)}
                onClick={() => setPage(current => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedId && (
        <Card className="border-cyan-300/15 bg-[#10131c] shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-white">
                  Job detail
                </CardTitle>
                <p className="mt-1 text-xs text-slate-500">{selectedId}</p>
              </div>
              {detail.data &&
                (detail.data.status === "QUEUED" ||
                  detail.data.status === "RETRYING") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancelJob.isPending}
                    onClick={() => cancelJob.mutate({ id: selectedId })}
                    className="border-rose-300/20 text-rose-200 hover:bg-rose-300/10"
                  >
                    Cancel job
                  </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {detail.isLoading ? (
              <p className="text-sm text-slate-500">Loading job detail…</p>
            ) : detail.error ? (
              <p className="text-sm text-rose-200">{detail.error.message}</p>
            ) : detail.data ? (
              <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Status</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${jobStatusClass(detail.data.status)}`}
                    >
                      {detail.data.status}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-slate-200">
                      {detail.data.progress}%
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Attempts</span>
                    <span className="text-slate-200">
                      {detail.data.attemptCount}/{detail.data.maxAttempts}
                    </span>
                  </div>
                  {detail.data.error && (
                    <div className="border-t border-white/[0.06] pt-3 text-xs text-rose-200">
                      {detail.data.error.code}: {detail.data.error.message}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Activity timeline
                  </p>
                  {activity.data?.length ? (
                    <div className="space-y-3">
                      {activity.data.map(event => (
                        <div key={event.id} className="flex gap-3 text-xs">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                          <div>
                            <p className="text-slate-300">{event.eventType}</p>
                            <p className="mt-1 text-slate-600">
                              {new Date(event.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No activity recorded yet.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Admin() {
  const overview = trpc.admin.overview.useQuery();
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const users = trpc.admin.users.useQuery({
    query: userSearch,
    page: userPage,
    pageSize: 10,
  });
  const userDetail = trpc.admin.userDetail.useQuery(
    { userId: selectedUserId ?? 0 },
    { enabled: selectedUserId !== null }
  );
  const activations = trpc.admin.activations.useQuery();
  const inboxes = trpc.admin.inboxes.useQuery();
  const walletLedger = trpc.admin.walletLedger.useQuery();
  const auditHistory = trpc.admin.auditHistory.useQuery({
    limit: 20,
    offset: 0,
  });
  const [adminJobStatus, setAdminJobStatus] = useState<
    | "ALL"
    | "QUEUED"
    | "PROCESSING"
    | "RETRYING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
  >("ALL");
  const jobMetrics = trpc.admin.jobs.metrics.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const adminJobs = trpc.admin.jobs.list.useQuery(
    {
      page: 0,
      pageSize: 10,
      ...(adminJobStatus === "ALL" ? {} : { status: adminJobStatus }),
    },
    { refetchInterval: 5000 }
  );
  const jobActivity = trpc.admin.jobs.activity.useQuery(
    { limit: 20 },
    { refetchInterval: 5000 }
  );
  const dispatchJobs = trpc.admin.jobs.dispatch.useMutation({
    onSuccess: () => {
      void jobMetrics.refetch();
      void adminJobs.refetch();
      void jobActivity.refetch();
    },
  });
  const sections = [
    [
      "Users",
      `${overview.data?.users ?? 0} protected users`,
      "Review account status and role assignments",
    ],
    [
      "Wallet ledger",
      `₦${((overview.data?.walletVolume ?? 0) / 100).toFixed(2)} recorded volume`,
      "Trace credits, debits, refunds, and adjustments",
    ],
    [
      "Delivery requests",
      `${activations.data?.length ?? 0} activations · ${inboxes.data?.length ?? 0} inboxes`,
      "Inspect mock SMS and mail request status",
    ],
    [
      "Providers",
      `${overview.data?.activeProviders ?? 0} evaluated · mock mode`,
      "Check provider health and operating mode",
    ],
    [
      "Pricing",
      "Server-side pricing rules",
      "Review safe Phase 1 pricing rules",
    ],
    [
      "Audit logs",
      `${auditHistory.data?.length ?? 0} recent events`,
      "Review structured operational events",
    ],
  ];
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-2 text-sm text-slate-500">
          Operations / Admin console
        </p>
        <h1 className="text-3xl font-semibold text-white">
          Operations overview
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Protected controls for reviewing users, wallet activity, and mock
          delivery operations.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          icon={LayoutDashboard}
          label="Total users"
          value={String(overview.data?.users ?? 0)}
          detail="Protected user count"
          accent="cyan"
        />
        <Metric
          icon={MessageSquareText}
          label="Requests today"
          value={String(overview.data?.requestsToday ?? 0)}
          detail="Database-backed request count"
          accent="cyan"
        />
        <Metric
          icon={CircleDollarSign}
          label="Wallet volume"
          value={`₦${((overview.data?.walletVolume ?? 0) / 100).toFixed(2)}`}
          detail="Auditable wallet volume"
          accent="cyan"
        />
        <Metric
          icon={ShieldCheck}
          label="Providers"
          value={String(overview.data?.activeProviders ?? 0).padStart(2, "0")}
          detail="Evaluated provider registry"
          accent="emerald"
        />
      </div>
      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-white">
                Job operations
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Safe aggregate metrics and redacted activity from the server.
              </p>
            </div>
            <Button
              size="sm"
              disabled={dispatchJobs.isPending}
              onClick={() => dispatchJobs.mutate({ limit: 10 })}
              className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
            >
              {dispatchJobs.isPending ? "Dispatching…" : "Run queued jobs"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {(
              [
                ["queued", "Queued"],
                ["processing", "Processing"],
                ["retrying", "Retrying"],
                ["completed", "Completed"],
                ["failed", "Failed"],
                ["cancelled", "Cancelled"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() =>
                  setAdminJobStatus(key.toUpperCase() as typeof adminJobStatus)
                }
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.05]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {label}
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {jobMetrics.data?.[key] ?? 0}
                </p>
              </button>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Recent jobs
                </p>
                <button
                  onClick={() => setAdminJobStatus("ALL")}
                  className="text-xs text-cyan-200 hover:text-cyan-100"
                >
                  {adminJobStatus === "ALL"
                    ? "All statuses"
                    : `Filter: ${adminJobStatus}`}
                </button>
              </div>
              {adminJobs.data?.items.length ? (
                <div className="space-y-2">
                  {adminJobs.data.items.map(job => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-200">
                            {jobTypeLabel(job.jobType)}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {job.id} · user #{job.userId}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${jobStatusClass(job.status)}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full bg-cyan-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No jobs match this status.
                </p>
              )}
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Recent job activity
              </p>
              {jobActivity.data?.length ? (
                <div className="space-y-2">
                  {jobActivity.data.slice(0, 6).map(event => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <p className="text-xs text-slate-300">
                        {event.eventType}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        {event.jobId} ·{" "}
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No job activity recorded.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base text-white">
                Admin Users
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Search by user ID, name, or email. Results are
                server-authoritative.
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={userSearch}
                onChange={event => {
                  setUserSearch(event.target.value);
                  setUserPage(0);
                }}
                placeholder="Search users"
                aria-label="Search users by ID, name, or email"
                className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading users…
            </p>
          ) : users.error ? (
            <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">
              {users.error.message || "Unable to load users."}
            </p>
          ) : users.data?.items.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[680px] divide-y divide-white/[0.06]">
                <div className="grid grid-cols-[1.4fr_1.5fr_0.7fr_0.8fr_1.1fr_0.8fr] gap-3 px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  <span>User</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Created</span>
                  <span>Activity</span>
                </div>
                {users.data.items.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className="grid w-full grid-cols-[1.4fr_1.5fr_0.7fr_0.8fr_1.1fr_0.8fr] gap-3 rounded-lg px-3 py-4 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="truncate text-sm font-medium text-slate-200">
                      {user.name || `User #${user.id}`}
                    </span>
                    <span className="truncate text-xs text-slate-400">
                      {user.email || "—"}
                    </span>
                    <span className="text-xs text-cyan-200">{user.role}</span>
                    <span className="text-xs text-slate-300">
                      {user.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(user.lastSignedIn).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              {userSearch
                ? "No users match this search."
                : "No persistent users are available."}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
            <span>
              {users.data?.total ?? 0} result
              {users.data?.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <span>
                Page {(users.data?.page ?? userPage) + 1} of{" "}
                {Math.max(users.data?.totalPages ?? 0, 1)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={userPage === 0 || users.isLoading}
                onClick={() => setUserPage(page => Math.max(0, page - 1))}
                className="border-white/10 bg-transparent text-slate-300 hover:bg-white/[0.05]"
                aria-label="Previous users page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !users.data ||
                  userPage + 1 >= users.data.totalPages ||
                  users.isLoading
                }
                onClick={() => setUserPage(page => page + 1)}
                className="border-white/10 bg-transparent text-slate-300 hover:bg-white/[0.05]"
                aria-label="Next users page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {selectedUserId !== null && (
        <Card className="border-cyan-300/15 bg-[#10131c] shadow-none">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base text-white">
                User detail
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Operational metadata only; private message bodies remain
                redacted.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUserId(null)}
              className="text-slate-400 hover:bg-white/[0.05] hover:text-white"
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {userDetail.isLoading ? (
              <p className="py-6 text-sm text-slate-500">
                Loading account detail…
              </p>
            ) : userDetail.error ? (
              <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">
                {userDetail.error.message || "Unable to load account detail."}
              </p>
            ) : userDetail.data ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {userDetail.data.account.name ||
                        `User #${userDetail.data.account.id}`}
                    </p>
                    <p className="text-sm text-slate-400">
                      {userDetail.data.account.email || "No email on record"}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge className="bg-cyan-300/10 text-cyan-200">
                      {userDetail.data.account.role}
                    </Badge>
                    <Badge className="bg-emerald-300/10 text-emerald-200">
                      {userDetail.data.account.status}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    icon={WalletCards}
                    label="Balance"
                    value={`₦${(userDetail.data.wallet.balanceMinor / 100).toFixed(2)}`}
                    detail={`${userDetail.data.wallet.transactionCount} transactions`}
                    accent="cyan"
                  />
                  <Metric
                    icon={MessageSquareText}
                    label="SMS requests"
                    value={String(userDetail.data.sms.total)}
                    detail={`${userDetail.data.sms.completed} completed · ${userDetail.data.sms.cancelled} cancelled`}
                    accent="cyan"
                  />
                  <Metric
                    icon={Inbox}
                    label="Mailboxes"
                    value={String(userDetail.data.mail.mailboxCount)}
                    detail={`${userDetail.data.mail.messageCount} messages`}
                    accent="emerald"
                  />
                  <Metric
                    icon={BarChart3}
                    label="Activity"
                    value={String(userDetail.data.activity.length)}
                    detail="Recent audit metadata"
                    accent="cyan"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
                    <p className="mb-3 font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Account
                    </p>
                    <p>
                      User ID:{" "}
                      <span className="text-slate-200">
                        {userDetail.data.account.id}
                      </span>
                    </p>
                    <p className="mt-2">
                      Created:{" "}
                      <span className="text-slate-200">
                        {new Date(
                          userDetail.data.account.createdAt
                        ).toLocaleString()}
                      </span>
                    </p>
                    <p className="mt-2">
                      Last activity:{" "}
                      <span className="text-slate-200">
                        {new Date(
                          userDetail.data.account.lastSignedIn
                        ).toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
                    <p className="mb-3 font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Wallet
                    </p>
                    <p>
                      Credits:{" "}
                      <span className="text-emerald-200">
                        ₦
                        {(userDetail.data.wallet.creditsMinor / 100).toFixed(2)}
                      </span>
                    </p>
                    <p className="mt-2">
                      Debits:{" "}
                      <span className="text-slate-200">
                        ₦{(userDetail.data.wallet.spentMinor / 100).toFixed(2)}
                      </span>
                    </p>
                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Recent ledger
                      </p>
                      {userDetail.data.wallet.recentTransactions.length ? (
                        userDetail.data.wallet.recentTransactions.map(
                          (entry, index) => (
                            <p
                              key={`${entry.reference}-${index}`}
                              className="mt-1 truncate text-slate-500"
                            >
                              {entry.type} · ₦
                              {(entry.amountMinor / 100).toFixed(2)} ·{" "}
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </p>
                          )
                        )
                      ) : (
                        <p className="text-slate-600">No wallet history.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Recent activity metadata
                  </p>
                  {userDetail.data.activity.length ? (
                    <div className="space-y-2">
                      {userDetail.data.activity.map((event, index) => (
                        <div
                          key={`${event.action}-${event.createdAt}-${index}`}
                          className="flex flex-wrap justify-between gap-2 text-xs"
                        >
                          <span className="text-slate-300">
                            {event.action} · {event.targetType || "system"}
                          </span>
                          <span className="text-slate-500">
                            {new Date(event.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No activity metadata recorded.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sections.map(([title, metric, detail]) => (
          <Card
            key={title}
            className="border-white/[0.07] bg-[#10131c] shadow-none transition hover:border-cyan-300/20"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-600" />
              </div>
              <h3 className="mt-5 text-sm font-semibold text-white">{title}</h3>
              <p className="mt-2 text-xs font-medium text-cyan-200">{metric}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Wallet() {
  const wallet = trpc.workspace.wallet.useQuery();
  const packages = trpc.workspace.pointPackages.useQuery();
  const addCredits = trpc.workspace.addDemoCredits.useMutation({
    onSuccess: () => wallet.refetch(),
  });
  const initializeTopUp = trpc.workspace.initializeTopUp.useMutation();
  const [selectedPackage, setSelectedPackage] = useState("pts_5");
  const [pendingTopUpId, setPendingTopUpId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("subby_pending_topup");
  });
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const topUpStatus = trpc.workspace.topUpStatus.useQuery(
    { topUpId: pendingTopUpId ?? "" },
    {
      enabled: Boolean(pendingTopUpId),
      refetchInterval: pendingTopUpId ? 3000 : false,
    }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "return" || params.get("payment") === "mock") {
      const ref = params.get("reference");
      const stored = sessionStorage.getItem("subby_pending_topup");
      if (stored) setPendingTopUpId(stored);
      setPaymentNotice(
        ref
          ? "Checking payment status with the server…"
          : "Returning from checkout — verifying payment…"
      );
    }
  }, []);

  useEffect(() => {
    if (!topUpStatus.data) return;
    if (topUpStatus.data.status === "completed") {
      setPaymentNotice(
        `Payment verified. ${topUpStatus.data.points.toLocaleString()} Points credited.`
      );
      sessionStorage.removeItem("subby_pending_topup");
      wallet.refetch();
    } else if (
      topUpStatus.data.status === "failed" ||
      topUpStatus.data.status === "cancelled"
    ) {
      setPaymentNotice("Payment was not completed. No Points were credited.");
    } else {
      setPaymentNotice("Payment is still pending verification…");
    }
  }, [topUpStatus.data, wallet]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-2 text-sm text-slate-500">Workspace / Wallet</p>
        <h1 className="text-3xl font-semibold text-white">Wallet</h1>
        <p className="mt-2 text-sm text-slate-400">
          Prices are live from the SMS catalog. Payments are verified server-side.
        </p>
      </div>
      <Card className="border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-[#10131c] shadow-none">
        <CardContent className="p-6">
          <p className="text-xs text-cyan-200/70">SUBBY Points balance</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
            {(wallet.data?.points ?? wallet.data?.balanceMinor ?? 0).toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Available for SMS activations and workspace services.
          </p>
          {paymentNotice && (
            <p className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-cyan-100">
              {paymentNotice}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-white">Buy Points</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Choose a package. Amount and Points are set by the server.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {(packages.data ?? []).map(pkg => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackage(pkg.id)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition",
                  selectedPackage === pkg.id
                    ? "border-cyan-300/50 bg-cyan-400/10"
                    : "border-white/10 bg-[#0a0c12] hover:border-white/20"
                )}
              >
                <p className="text-sm font-medium text-white">{pkg.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {pkg.points} Point{pkg.points === 1 ? "" : "s"} — ₦
                  {(pkg.ngnMajor ?? pkg.amountMinor / 100).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
          <Button
            disabled={initializeTopUp.isPending || !selectedPackage}
            onClick={async () => {
              const result = await initializeTopUp.mutateAsync({
                packageId: selectedPackage,
                idempotencyKey: crypto.randomUUID(),
              });
              sessionStorage.setItem("subby_pending_topup", result.topUpId);
              setPendingTopUpId(result.topUpId);
              if (result.authorizationUrl) {
                window.location.href = result.authorizationUrl;
              }
            }}
            className="h-11 w-full rounded-lg bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200"
          >
            {initializeTopUp.isPending ? "Starting checkout…" : "Pay securely"}
          </Button>
          <Button
            variant="outline"
            disabled={addCredits.isPending}
            onClick={() =>
              addCredits.mutate({
                amountMinor: 8000,
                requestId: crypto.randomUUID(),
              })
            }
            className="h-10 w-full rounded-lg border-white/10 text-slate-300"
          >
            Add demo points (dev)
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-white">Ledger</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Immutable credits, debits, and refunds.
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/[0.06]">
            {(wallet.data?.ledger ?? []).length > 0 ? (
              (wallet.data?.ledger ?? []).map(
                (entry: {
                  id: string;
                  type: string;
                  amountMinor: number;
                  points?: number;
                  description?: string;
                  reason?: string;
                  referenceId?: string;
                  reference?: string;
                  createdAt: string;
                }) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center gap-3 py-4"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">
                        {entry.description ?? entry.reason ?? entry.type}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-slate-600">
                        {entry.referenceId ?? entry.reference}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "w-full text-right text-sm font-semibold sm:w-auto",
                        entry.type === "CREDIT" || entry.type === "REFUND"
                          ? "text-emerald-300"
                          : "text-slate-300"
                      )}
                    >
                      {entry.type === "CREDIT" || entry.type === "REFUND"
                        ? "+"
                        : "−"}
                      {(entry.points ?? entry.amountMinor).toLocaleString()} pts
                    </p>
                  </div>
                )
              )
            ) : (
              <p className="py-4 text-sm text-slate-500">No transactions yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function LegacyWallet() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-2 text-sm text-slate-500">Workspace / Wallet</p>
        <h1 className="text-3xl font-semibold text-white">Wallet</h1>
        <p className="mt-2 text-sm text-slate-400">
          Every credit and debit is recorded in an auditable ledger.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-[#10131c] shadow-none">
          <CardContent className="p-6">
            <p className="text-xs text-cyan-200/70">NGN available balance</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
              ₦24,680.00
            </p>
            <Button className="mt-6 rounded-lg bg-cyan-300 text-xs font-semibold text-slate-950 hover:bg-cyan-200">
              <Plus className="mr-2 h-3.5 w-3.5" /> Add funds{" "}
              <span className="ml-1 text-slate-700">(demo)</span>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
          <CardContent className="p-6">
            <p className="text-xs text-slate-500">USD architecture</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
              $0.00
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Ready for a future multi-currency expansion.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-white">
              Ledger activity
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Immutable entries, newest first
            </p>
          </div>
          <Badge className="border-white/10 bg-white/5 text-slate-400">
            All time
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/[0.06]">
            {[
              ["Wallet top-up", "+₦8,000.00", "Credit", "Today, 09:42"],
              ["Account verification", "−₦150.00", "Debit", "Today, 09:18"],
              ["Sandbox testing", "−₦80.00", "Debit", "Yesterday, 16:04"],
            ].map(([a, b, c, d]) => (
              <div key={d} className="flex items-center gap-4 py-4">
                <div
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg",
                    c === "Credit"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-violet-400/10 text-violet-300"
                  )}
                >
                  {c === "Credit" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 rotate-180" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{a}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {d} · {c}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    c === "Credit" ? "text-emerald-300" : "text-slate-300"
                  )}
                >
                  {b}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();
  const initialSection =
    location === "/dashboard" || location === "/"
      ? "overview"
      : location.slice(1) || "overview";
  const [active, setActive] = useState(initialSection);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const title = nav.find(n => n.id === active)?.label ?? "Overview";
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080a0f] p-6 text-slate-200">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
          <p className="mt-4 text-sm text-slate-400">Checking your session…</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080a0f] p-6 text-slate-200">
        <Card className="w-full max-w-md border-white/[0.08] bg-[#10131c] shadow-2xl shadow-cyan-950/20">
          <CardHeader>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-sm font-black text-[#07101e]">
              S
            </div>
            <CardTitle className="pt-4 text-xl text-white">
              Sign in to SUBBY VIRTUAL
            </CardTitle>
            <p className="text-sm leading-6 text-slate-400">
              Your workspace, jobs, and mock delivery records are protected.
            </p>
          </CardHeader>
          <CardContent>
            <LocalAuthCard />
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="workspace-shell min-h-screen bg-[#080a0f] text-slate-200">
      <Sidebar
        active={active}
        setActive={setActive}
        isAdmin={isAdmin}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onSignOut={() => void logout()}
      />
      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-[#080a0f]/90 px-5 backdrop-blur-xl md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <BrandMark size={28} className="lg:hidden" />
            <div className="hidden min-w-0 text-sm font-medium text-slate-500 md:block">
              Workspace <span className="mx-2 text-slate-700">/</span>{" "}
              <span className="truncate text-slate-300">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[11px] text-emerald-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />{" "}
              All systems operational
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-xs font-bold text-cyan-200">
              {user?.name?.slice(0, 1) ?? "O"}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] overflow-x-hidden p-4 sm:p-5 md:p-10">
          {active === "overview" && <Overview setActive={setActive} />}
          {active === "sms" && <RequestPage type="sms" />}
          {active === "mail" && <RequestPage type="mail" />}
          {active === "wallet" && <Wallet />}
          {active === "jobs" && <Jobs />}
          {active === "activity" && <Wallet />}
          {active === "transactions" && <Transactions />}
          {active === "admin" && isAdmin ? (
            <Admin />
          ) : active === "admin" ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-8">
              <h1 className="text-2xl font-semibold text-white">
                Access restricted
              </h1>
              <p className="mt-2 text-sm text-rose-100/70">
                Administrator authorization is required to view user management.
              </p>
            </div>
          ) : null}
          {active === "settings" && (
            <div className="rounded-2xl border border-white/10 bg-[#10131c] p-8">
              <h1 className="text-2xl font-semibold text-white">Settings</h1>
              <p className="mt-2 text-sm text-slate-400">
                Account preferences and compliance controls will live here.
              </p>
            </div>
          )}
          {active === "support" && (
            <div className="rounded-2xl border border-white/10 bg-[#10131c] p-8">
              <h1 className="text-2xl font-semibold text-white">Support</h1>
              <p className="mt-2 text-sm text-slate-400">
                Need help with a mock delivery request? Open a support ticket
                for the operations team.
              </p>
              <p className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-500">
                Support ticket intake is not available in Phase 1.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
