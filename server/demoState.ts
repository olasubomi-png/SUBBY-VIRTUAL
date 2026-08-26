export type DemoActivation = {
  id: string;
  userId: number;
  country: string;
  serviceId: string;
  phoneNumber: string;
  status: "ACTIVE" | "MESSAGE_RECEIVED" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  priceMinor: number;
  createdAt: string;
  expiresAt: string;
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
export function createDemoActivation(input: {
  userId: number;
  country: string;
  serviceId: string;
  priceMinor: number;
}) {
  const id = `demo-activation-${input.userId}-${Date.now()}`;
  const activation: DemoActivation = {
    id,
    userId: input.userId,
    country: input.country,
    serviceId: input.serviceId,
    phoneNumber:
      input.country === "NG"
        ? "+234 809 440 2186"
        : input.country === "GB"
          ? "+44 7400 123 866"
          : "+1 202 555 0147",
    status: "ACTIVE",
    priceMinor: input.priceMinor,
    createdAt: now(),
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
  if (item.status !== "ACTIVE") throw new Error("Invalid activation state");
  item.status = "COMPLETED";
  item.message = {
    sender: "SUBBY-DEMO",
    body: "Your simulated verification code is 482913.",
    receivedAt: now(),
  };
  return item;
}
export function cancelSms(userId: number, id: string) {
  const item = getActivation(userId, id);
  if (item.status !== "ACTIVE")
    throw new Error("Activation cannot be cancelled");
  item.status = "CANCELLED";
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
