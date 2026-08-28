import {
  assertSmsOrderTransitionFromRaw,
  isCodeEligibleSmsOrderStatus,
  isExpirableSmsOrderStatus,
  isCancellableSmsOrderStatus,
  normalizeSmsOrderStatus,
} from "./smsOrderLifecycle";
export type DemoActivation = {
  id: string;
  userId: number;
  country: string;
  serviceId: string;
  phoneNumber: string;
  /** Canonical SMS order status only — never store legacy uppercase values. */
  status:
    | "pending"
    | "allocating"
    | "active"
    | "code_received"
    | "completed"
    | "cancelled"
    | "expired"
    | "failed";
  priceMinor: number;
  currency?: "NGN" | "USD";
  idempotencyKey?: string;
  providerReference?: string;
  verificationCode?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt: string;
  cancelledAt?: string;
  message?: { sender: string; body: string; receivedAt: string };
};

export type DemoInbox = {
  id: string;
  userId: number;
  address: string;
  status: "ACTIVE" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
  messages: Array<{
    sender: string;
    subject: string;
    body: string;
    receivedAt: string;
  }>;
};

type DemoWallet = {
  balanceMinor: number;
  creditsMinor: number;
  spentMinor: number;
  ledger: Array<{
    id: string;
    type: "CREDIT" | "DEBIT";
    amountMinor: number;
    description: string;
    referenceId: string;
    createdAt: string;
  }>;
};
const wallets = new Map<number, DemoWallet>();
const activations = new Map<string, DemoActivation>();
const inboxes = new Map<string, DemoInbox>();
const now = () => new Date().toISOString();
const walletFor = (userId: number) => {
  const existing = wallets.get(userId);
  if (existing) return existing;
  const wallet: DemoWallet = {
    balanceMinor: 0,
    creditsMinor: 0,
    spentMinor: 0,
    ledger: [],
  };
  wallets.set(userId, wallet);
  return wallet;
};
export function addDemoCredits(
  userId: number,
  amountMinor: number,
  referenceId: string
) {
  const wallet = walletFor(userId);
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > 1000000
  )
    throw new Error("Demo credit amount is invalid");
  if (wallet.ledger.some(item => item.referenceId === referenceId))
    return wallet;
  const createdAt = now();
  wallet.balanceMinor += amountMinor;
  wallet.creditsMinor += amountMinor;
  wallet.ledger.unshift({
    id: `demo-ledger-${referenceId}`,
    type: "CREDIT",
    amountMinor,
    description: "Demo credits",
    referenceId,
    createdAt,
  });
  return wallet;
}
export function debitDemoCredits(
  userId: number,
  amountMinor: number,
  description: string,
  referenceId: string
) {
  const wallet = walletFor(userId);
  if (wallet.ledger.some(item => item.referenceId === referenceId))
    return wallet;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
    throw new Error("Debit amount is invalid");
  if (wallet.balanceMinor < amountMinor)
    throw new Error("Insufficient demo credits");
  wallet.balanceMinor -= amountMinor;
  wallet.spentMinor += amountMinor;
  wallet.ledger.unshift({
    id: `demo-ledger-${referenceId}`,
    type: "DEBIT",
    amountMinor,
    description,
    referenceId,
    createdAt: now(),
  });
  return wallet;
}
export function getDemoWallet(userId: number) {
  return walletFor(userId);
}

const demoPhonePrefixes: Record<string, string> = {
  NG: "+234 809 440 2186",
  US: "+1 202 555 0147",
  GB: "+44 7400 123 866",
  CA: "+1 416 555 0198",
  DE: "+49 151 23456789",
  FR: "+33 6 12 34 56 78",
  IT: "+39 312 345 6789",
  ES: "+34 612 345 678",
  NL: "+31 6 12345678",
  BE: "+32 470 12 34 56",
  SE: "+46 70 123 45 67",
  NO: "+47 412 34 567",
  DK: "+45 20 12 34 56",
  FI: "+358 40 123 4567",
  PL: "+48 512 345 678",
  AU: "+61 412 345 678",
  NZ: "+64 21 123 4567",
  IN: "+91 98765 43210",
  BR: "+55 11 91234 5678",
  MX: "+52 55 1234 5678",
  ZA: "+27 82 123 4567",
  KE: "+254 712 345678",
  GH: "+233 24 123 4567",
  AE: "+971 50 123 4567",
  SA: "+966 50 123 4567",
};
function demoPhoneForCountry(country: string) {
  return demoPhonePrefixes[country] ?? "+1 202 555 0147";
}
export function createDemoActivation(input: {
  userId: number;
  country: string;
  serviceId: string;
  priceMinor: number;
  currency?: "NGN" | "USD";
  idempotencyKey?: string;
  status?: DemoActivation["status"];
  phoneNumber?: string;
  providerReference?: string;
}) {
  if (input.idempotencyKey) {
    const existing = Array.from(activations.values()).find(
      item =>
        item.userId === input.userId &&
        item.idempotencyKey === input.idempotencyKey
    );
    if (existing) return existing;
  }
  const id = input.idempotencyKey
    ? `sms-order-${input.userId}-${input.idempotencyKey}`
    : `demo-activation-${input.userId}-${Date.now()}`;
  const createdAt = now();
  const activation: DemoActivation = {
    id,
    userId: input.userId,
    country: input.country,
    serviceId: input.serviceId,
    phoneNumber: input.phoneNumber ?? demoPhoneForCountry(input.country),
    status: input.status ?? "active",
    priceMinor: input.priceMinor,
    currency: input.currency ?? "NGN",
    idempotencyKey: input.idempotencyKey,
    providerReference: input.providerReference,
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
  activations.set(id, activation);
  return activation;
}
export function getActivation(userId: number, id: string) {
  const item = activations.get(id);
  if (!item || item.userId !== userId) throw new Error("Activation not found");
  return item;
}
export function simulateSms(userId: number, id: string) {
  const item = getActivation(userId, id);
  const from = normalizeSmsOrderStatus(item.status);
  if (!isCodeEligibleSmsOrderStatus(from)) {
    throw new Error("Invalid activation state");
  }
  if (from === "active") {
    assertSmsOrderTransitionFromRaw(item.status, "code_received");
    item.status = "code_received";
  }
  assertSmsOrderTransitionFromRaw(item.status, "completed");
  item.status = "completed";
  item.verificationCode = item.verificationCode ?? "482913";
  item.updatedAt = now();
  item.message = {
    sender: "SUBBY-DEMO",
    body: `Your simulated verification code is ${item.verificationCode}.`,
    receivedAt: item.updatedAt,
  };
  return item;
}
export function cancelSms(userId: number, id: string) {
  const item = getActivation(userId, id);
  const from = normalizeSmsOrderStatus(item.status);
  if (!isCancellableSmsOrderStatus(from))
    throw new Error("Activation cannot be cancelled");
  assertSmsOrderTransitionFromRaw(item.status, "cancelled");
  item.status = "cancelled";
  item.cancelledAt = now();
  item.updatedAt = item.cancelledAt;
  return item;
}
export function expireActivation(userId: number, id: string) {
  const item = getActivation(userId, id);
  const from = normalizeSmsOrderStatus(item.status);
  if (from === "expired") return item;
  if (!isExpirableSmsOrderStatus(from))
    throw new Error("Activation cannot be expired in its current state");
  assertSmsOrderTransitionFromRaw(item.status, "expired");
  item.status = "expired";
  item.updatedAt = now();
  return item;
}
export function listActivations(userId: number) {
  return Array.from(activations.values())
    .filter(item => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function createDemoInbox(userId: number, label: string) {
  const id = `demo-inbox-${userId}-${Date.now()}`;
  const inbox: DemoInbox = {
    id,
    userId,
    address: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${userId}@subby.demo`,
    status: "ACTIVE",
    createdAt: now(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    messages: [],
  };
  inboxes.set(id, inbox);
  return inbox;
}
export function getInbox(userId: number, id: string) {
  const item = inboxes.get(id);
  if (!item || item.userId !== userId) throw new Error("Inbox not found");
  return item;
}
export function simulateEmail(userId: number, id: string) {
  const inbox = getInbox(userId, id);
  if (inbox.status !== "ACTIVE") throw new Error("Inbox is expired");
  if (inbox.messages.length > 0)
    throw new Error("Inbox already has a simulated message");
  inbox.messages.unshift({
    sender: "hello@subby.demo",
    subject: "Demo inbox message",
    body: "This simulated email confirms your Phase 1 inbox is working.",
    receivedAt: now(),
  });
  return inbox;
}
export function expireInbox(userId: number, id: string) {
  const inbox = getInbox(userId, id);
  inbox.status = "EXPIRED";
  return inbox;
}
export function listInboxes(userId: number) {
  return Array.from(inboxes.values())
    .filter(item => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function listAllActivations() {
  return Array.from(activations.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
export function listAllInboxes() {
  return Array.from(inboxes.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
export function listAllWallets() {
  return Array.from(wallets.entries()).map(([userId, wallet]) => ({
    userId,
    balanceMinor: wallet.balanceMinor,
    ledger: wallet.ledger,
  }));
}

export function resetDemoState() {
  wallets.clear();
  activations.clear();
  inboxes.clear();
}
