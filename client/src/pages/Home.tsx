import { startLogin } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "sms", label: "SMS requests", icon: MessageSquareText },
  { id: "mail", label: "Mail inboxes", icon: Inbox },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "activity", label: "Activity", icon: BarChart3 },
  { id: "transactions", label: "Transactions", icon: CircleDollarSign },
  { id: "settings", label: "Settings", icon: ShieldCheck },
  { id: "support", label: "Support", icon: Inbox },
  { id: "admin", label: "Admin console", icon: ShieldCheck },
];

const smsRequests = [
  {
    service: "Account verification",
    number: "+234 809 440 2186",
    country: "NG",
    status: "Waiting",
    time: "Just now",
  },
  {
    service: "Sandbox testing",
    number: "+44 7400 123 866",
    country: "GB",
    status: "Code received",
    time: "12 min ago",
  },
  {
    service: "Product alerts",
    number: "+1 202 555 0147",
    country: "US",
    status: "Completed",
    time: "Yesterday",
  },
];

function Sidebar({
  active,
  setActive,
  mobileOpen,
  setMobileOpen,
}: {
  active: string;
  setActive: (id: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/[0.07] bg-[#0a0c12] px-5 py-6 transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-sm font-black text-[#07101e] shadow-[0_0_24px_rgba(34,211,238,0.25)]">
            S
          </div>
          <div>
            <div className="text-sm font-bold tracking-[0.18em] text-white">
              SUBBY
            </div>
            <div className="text-[10px] font-semibold tracking-[0.24em] text-cyan-300/80">
              VIRTUAL
            </div>
          </div>
        </div>
        <div className="mt-12 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Workspace
        </div>
        <nav className="mt-3 space-y-1">
          {nav.map(item => {
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
        <button className="mt-5 flex items-center gap-3 px-3 py-2 text-sm text-slate-500 transition hover:text-white">
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
  const summary = trpc.workspace.summary.useQuery();
  const requests = trpc.workspace.smsRequests.useQuery();
  const balance = summary.data?.balance.NGN ?? 0;
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm text-slate-500">Tuesday, 26 August 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Good morning, <span className="text-cyan-300">Olasubomi.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Your communications workspace is clear and ready for the next
            request.
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
  const simulateSms = trpc.workspace.simulateSms.useMutation({
    onSuccess: () => {
      setFeedback("Simulated SMS received; activation completed.");
      smsRequests.refetch();
    },
  });
  const cancelSms = trpc.workspace.cancelSms.useMutation({
    onSuccess: () => {
      setFeedback("SMS activation cancelled successfully.");
      smsRequests.refetch();
    },
  });
  const simulateEmail = trpc.workspace.simulateEmail.useMutation({
    onSuccess: () => {
      setFeedback("Simulated email received successfully.");
      mailInboxes.refetch();
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
                  >
                    <option value="NG">Nigeria (NG)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="US">United States (US)</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Service
                  <select
                    value={serviceId}
                    onChange={e => setServiceId(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0a0c12] px-3 text-sm text-slate-200"
                  >
                    {smsOptions.data?.services.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.name} · ₦
                        {smsOptions.data.pricing.find(
                          p => p.serviceId === service.id
                        )?.amount ?? 0}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={createSms.isPending}
                  onClick={() => createSms.mutate({ country, serviceId })}
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
                        className="mt-3 border-white/10 bg-transparent text-xs text-slate-300"
                        onClick={() => simulateSms.mutate({ id: item.id })}
                      >
                        Simulate SMS
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
                        onClick={() => simulateEmail.mutate({ id: item.id })}
                      >
                        Simulate email
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

function LegacyRequestPage({ type }: { type: "sms" | "mail" }) {
  const [created, setCreated] = useState(false);
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
          {type === "sms"
            ? "Create a mock activation and watch its status update safely."
            : "Create a temporary demo inbox for receiving simulated messages."}
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="border-cyan-300/15 bg-[#10131c] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-white">
              {type === "sms" ? "New SMS request" : "New temporary inbox"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-xs font-medium text-slate-400">
              {type === "sms" ? "Country" : "Inbox label"}
              <select className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0a0c12] px-3 text-sm text-slate-200 outline-none focus:border-cyan-300/50">
                <option>
                  {type === "sms" ? "Nigeria (NG)" : "verification"}
                </option>
                <option>
                  {type === "sms" ? "United Kingdom (GB)" : "receipts"}
                </option>
                <option>
                  {type === "sms" ? "United States (US)" : "support"}
                </option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-400">
              {type === "sms" ? "Service" : "Expiry"}
              <select className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0a0c12] px-3 text-sm text-slate-200 outline-none focus:border-cyan-300/50">
                <option>
                  {type === "sms" ? "Account verification · ₦150" : "24 hours"}
                </option>
                <option>
                  {type === "sms" ? "Sandbox testing · ₦80" : "7 days"}
                </option>
              </select>
            </label>
            <Button
              onClick={() => setCreated(true)}
              className="h-11 w-full rounded-lg bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200"
            >
              {created ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Request created
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Create mock request
                </>
              )}
            </Button>
            <p className="text-center text-[11px] leading-5 text-slate-500">
              Demo only. This action does not contact any external provider.
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-white">
              {type === "sms" ? "Active SMS requests" : "Your demo inboxes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(type === "sms"
              ? smsRequests
              : [
                  {
                    service: "verification@subby.demo",
                    number: "1 message",
                    country: "24h left",
                    status: "Active",
                    time: "Created today",
                  },
                ]
            ).map((r: any) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] p-4"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
                  {type === "sms" ? (
                    <MessageSquareText className="h-4 w-4" />
                  ) : (
                    <Inbox className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">
                    {r.serviceId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.phoneNumber} ·{" "}
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <StatusPill
                  status={r.status === "Active" ? "Waiting" : r.status}
                />
              </div>
            ))}
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
                    {entry.type === "CREDIT" ? "+" : "−"}₦
                    {(entry.amountMinor / 100).toFixed(2)}
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

function Admin() {
  const overview = trpc.admin.overview.useQuery();
  const activations = trpc.admin.activations.useQuery();
  const inboxes = trpc.admin.inboxes.useQuery();
  const walletLedger = trpc.admin.walletLedger.useQuery();
  const auditHistory = trpc.admin.auditHistory.useQuery({
    limit: 20,
    offset: 0,
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
  const addCredits = trpc.workspace.addDemoCredits.useMutation({
    onSuccess: () => wallet.refetch(),
  });
  const amountMinor = 8000;
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-2 text-sm text-slate-500">Workspace / Wallet</p>
        <h1 className="text-3xl font-semibold text-white">Wallet</h1>
        <p className="mt-2 text-sm text-slate-400">
          Server-authoritative Demo Credits with an auditable ledger.
        </p>
      </div>
      <Card className="border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-[#10131c] shadow-none">
        <CardContent className="p-6">
          <p className="text-xs text-cyan-200/70">NGN available demo balance</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
            ₦{((wallet.data?.balanceMinor ?? 0) / 100).toFixed(2)}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Credits added: ₦
              {((wallet.data?.creditsMinor ?? 0) / 100).toFixed(2)}
            </span>
            <span>
              Spent: ₦{((wallet.data?.spentMinor ?? 0) / 100).toFixed(2)}
            </span>
          </div>
          <Button
            disabled={addCredits.isPending}
            onClick={() =>
              addCredits.mutate({ amountMinor, requestId: crypto.randomUUID() })
            }
            className="mt-6 rounded-lg bg-cyan-300 text-xs font-semibold text-slate-950 hover:bg-cyan-200"
          >
            <Plus className="mr-2 h-3.5 w-3.5" /> Add ₦80.00 demo credits
          </Button>
        </CardContent>
      </Card>
      <Card className="border-white/[0.07] bg-[#10131c] shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Ledger activity
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Every demo credit and request debit is server-recorded.
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/[0.06]">
            {wallet.data?.ledger.length ? (
              wallet.data.ledger.map(item => (
                <div key={item.id} className="flex items-center gap-4 py-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">
                      {item.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.referenceId} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      item.type === "CREDIT"
                        ? "text-emerald-300"
                        : "text-slate-300"
                    )}
                  >
                    {item.type === "CREDIT" ? "+" : "−"}₦
                    {(item.amountMinor / 100).toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-500">
                No transactions yet. Add demo credits to begin.
              </p>
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
  const { user } = useAuth();
  const [location] = useLocation();
  const initialSection =
    location === "/dashboard" || location === "/"
      ? "overview"
      : location.slice(1) || "overview";
  const [active, setActive] = useState(initialSection);
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = nav.find(n => n.id === active)?.label ?? "Overview";
  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-200">
      <Sidebar
        active={active}
        setActive={setActive}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-[#080a0f]/90 px-5 backdrop-blur-xl md:px-10">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden text-sm font-medium text-slate-500 md:block">
              Workspace <span className="mx-2 text-slate-700">/</span>{" "}
              <span className="text-slate-300">{title}</span>
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
        <main className="mx-auto max-w-[1400px] p-5 md:p-10">
          {active === "overview" && <Overview setActive={setActive} />}
          {active === "sms" && <RequestPage type="sms" />}
          {active === "mail" && <RequestPage type="mail" />}
          {active === "wallet" && <Wallet />}
          {active === "activity" && <Wallet />}
          {active === "transactions" && <Transactions />}
          {active === "admin" && <Admin />}
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
              <Button className="mt-6 rounded-lg bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                Open support ticket
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
