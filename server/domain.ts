export type Currency = "NGN" | "USD";
export type LedgerEntryType = "CREDIT" | "DEBIT";

export type LedgerEntry = {
  id: string;
  type: LedgerEntryType;
  amount: number;
  currency: Currency;
  reason: string;
  reference: string;
  createdAt: string;
};

export type WalletSnapshot = {
  balances: Record<Currency, number>;
  entries: LedgerEntry[];
};

export function calculateBalance(
  entries: LedgerEntry[],
  currency: Currency
): number {
  return entries
    .filter(entry => entry.currency === currency)
    .reduce(
      (balance, entry) =>
        balance + (entry.type === "CREDIT" ? entry.amount : -entry.amount),
      0
    );
}

export function canDebit(
  entries: LedgerEntry[],
  amount: number,
  currency: Currency
): boolean {
  return amount > 0 && calculateBalance(entries, currency) >= amount;
}

export function appendLedgerEntry(
  entries: LedgerEntry[],
  entry: LedgerEntry
): LedgerEntry[] {
  if (entry.amount <= 0) throw new Error("Ledger amounts must be positive");
  if (entries.some(existing => existing.id === entry.id))
    throw new Error("Ledger entry IDs must be unique");
  if (
    entry.type === "DEBIT" &&
    !canDebit(entries, entry.amount, entry.currency)
  ) {
    throw new Error("Insufficient balance");
  }
  return [...entries, entry];
}

export type CreateInboxInput = { userId: number; label?: string };
export type TemporaryInbox = {
  id: string;
  address: string;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED";
};
export type MailMessage = {
  id: string;
  inboxId: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
};

export interface MailProvider {
  createTemporaryInbox(input: CreateInboxInput): Promise<TemporaryInbox>;
  getMessages(inboxId: string): Promise<MailMessage[]>;
  deleteInbox(inboxId: string): Promise<void>;
  extendExpiry(inboxId: string, expiresAt: Date): Promise<void>;
}

export class LocalDemoMailProvider implements MailProvider {
  private readonly inboxes = new Map<string, TemporaryInbox>();
  async createTemporaryInbox(input: CreateInboxInput): Promise<TemporaryInbox> {
    const id = `inbox_${input.userId}_${Date.now()}`;
    const inbox = {
      id,
      address: `${input.label ?? "inbox"}.${input.userId}@subby.demo`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: "ACTIVE" as const,
    };
    this.inboxes.set(id, inbox);
    return inbox;
  }
  async getMessages(inboxId: string): Promise<MailMessage[]> {
    const inbox = this.inboxes.get(inboxId);
    if (!inbox || inbox.status !== "ACTIVE") return [];
    return [
      {
        id: `message_${inboxId}`,
        inboxId,
        from: "hello@subby.demo",
        subject: "Your demo inbox is ready",
        preview: "This is a safe Phase 1 mock message.",
        receivedAt: new Date().toISOString(),
      },
    ];
  }
  async deleteInbox(inboxId: string): Promise<void> {
    const inbox = this.inboxes.get(inboxId);
    if (inbox) this.inboxes.set(inboxId, { ...inbox, status: "EXPIRED" });
  }
  async extendExpiry(inboxId: string, expiresAt: Date): Promise<void> {
    const inbox = this.inboxes.get(inboxId);
    if (inbox && inbox.status === "ACTIVE")
      this.inboxes.set(inboxId, {
        ...inbox,
        expiresAt: expiresAt.toISOString(),
      });
  }
}

export type SMSProvider = {
  getCountries(): Promise<Array<{ code: string; name: string }>>;
  getServices(): Promise<Array<{ id: string; name: string }>>;
  getPricing(): Promise<
    Array<{ serviceId: string; amount: number; currency: Currency }>
  >;
  buyActivation(input: {
    userId: number;
    country: string;
    serviceId: string;
  }): Promise<{ id: string; phoneNumber: string; status: "WAITING" }>;
  getStatus(activationId: string): Promise<{
    id: string;
    status: "WAITING" | "RECEIVED" | "CANCELLED";
    code?: string;
  }>;
  cancelActivation(activationId: string): Promise<void>;
};

export class MockSMSProvider implements SMSProvider {
  private readonly activations = new Map<
    string,
    { createdAt: number; cancelled: boolean }
  >();
  async getCountries() {
    return [
      { code: "NG", name: "Nigeria" },
      { code: "GB", name: "United Kingdom" },
      { code: "US", name: "United States" },
    ];
  }
  async getServices() {
    return [
      { id: "verify", name: "Verification" },
      { id: "alerts", name: "Alerts" },
      { id: "sandbox", name: "Sandbox testing" },
    ];
  }
  async getPricing() {
    return [
      { serviceId: "verify", amount: 150, currency: "NGN" as const },
      { serviceId: "alerts", amount: 120, currency: "NGN" as const },
      { serviceId: "sandbox", amount: 80, currency: "NGN" as const },
    ];
  }
  async buyActivation(_input: {
    userId: number;
    country: string;
    serviceId: string;
  }) {
    const id = `activation_${Date.now()}`;
    this.activations.set(id, { createdAt: Date.now(), cancelled: false });
    return { id, phoneNumber: "+234 809 440 2186", status: "WAITING" as const };
  }
  async getStatus(activationId: string) {
    const activation = this.activations.get(activationId);
    if (!activation || activation.cancelled)
      return { id: activationId, status: "CANCELLED" as const };
    return Date.now() - activation.createdAt > 1500
      ? { id: activationId, status: "RECEIVED" as const, code: "482913" }
      : { id: activationId, status: "WAITING" as const };
  }
  async cancelActivation(activationId: string) {
    const activation = this.activations.get(activationId);
    if (activation)
      this.activations.set(activationId, { ...activation, cancelled: true });
  }
}
