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
  if (entry.amount <= 0) {
    throw new Error("Ledger amounts must be positive");
  }

  if (entries.some(existing => existing.id === entry.id)) {
    throw new Error("Ledger entry IDs must be unique");
  }

  if (
    entry.type === "DEBIT" &&
    !canDebit(entries, entry.amount, entry.currency)
  ) {
    throw new Error("Insufficient balance");
  }

  return [...entries, entry];
}

export type CreateInboxInput = {
  userId: number;
  label?: string;
};

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
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
  createTemporaryInbox(input: CreateInboxInput): Promise<TemporaryInbox>;
  getMessages(inboxId: string): Promise<MailMessage[]>;
  deleteInbox(inboxId: string): Promise<void>;
  extendExpiry(inboxId: string, expiresAt: Date): Promise<void>;
}

export class LocalDemoMailProvider implements MailProvider {
  private readonly inboxes = new Map<string, TemporaryInbox>();

  async healthCheck() {
    return {
      ok: true,
      detail: "local demo inbox store reachable",
    };
  }

  async createTemporaryInbox(
    input: CreateInboxInput
  ): Promise<TemporaryInbox> {
    const id = `inbox_${input.userId}_${Date.now()}`;

    const inbox: TemporaryInbox = {
      id,
      address: `${input.label ?? "inbox"}.${input.userId}@subby.demo`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: "ACTIVE",
    };

    this.inboxes.set(id, inbox);

    return inbox;
  }

  async getMessages(inboxId: string): Promise<MailMessage[]> {
    const inbox = this.inboxes.get(inboxId);

    if (!inbox || inbox.status !== "ACTIVE") {
      return [];
    }

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

    if (inbox) {
      this.inboxes.set(inboxId, {
        ...inbox,
        status: "EXPIRED",
      });
    }
  }

  async extendExpiry(
    inboxId: string,
    expiresAt: Date
  ): Promise<void> {
    const inbox = this.inboxes.get(inboxId);

    if (inbox && inbox.status === "ACTIVE") {
      this.inboxes.set(inboxId, {
        ...inbox,
        expiresAt: expiresAt.toISOString(),
      });
    }
  }
}

export type SMSProvider = {
  healthCheck(): Promise<{ ok: boolean; detail: string }>;

  getCountries(): Promise<
    Array<{
      code: string;
      name: string;
    }>
  >;

  getServices(): Promise<
    Array<{
      id: string;
      name: string;
    }>
  >;

  getPricing(): Promise<
    Array<{
      serviceId: string;
      amount: number;
      currency: Currency;
    }>
  >;

  buyActivation(input: {
    userId: number;
    country: string;
    serviceId: string;
  }): Promise<{
    id: string;
    phoneNumber: string;
    status: "WAITING";
  }>;

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
    {
      createdAt: number;
      cancelled: boolean;
      phoneNumber: string;
    }
  >();

  async healthCheck() {
    return {
      ok: true,
      detail: "mock activation store reachable",
    };
  }

  async getCountries() {
    return [
      { code: "NG", name: "Nigeria" },
      { code: "US", name: "United States" },
      { code: "GB", name: "United Kingdom" },
      { code: "CA", name: "Canada" },
      { code: "DE", name: "Germany" },
      { code: "FR", name: "France" },
      { code: "IT", name: "Italy" },
      { code: "ES", name: "Spain" },
      { code: "NL", name: "Netherlands" },
      { code: "BE", name: "Belgium" },
      { code: "SE", name: "Sweden" },
      { code: "NO", name: "Norway" },
      { code: "DK", name: "Denmark" },
      { code: "FI", name: "Finland" },
      { code: "PL", name: "Poland" },
      { code: "AU", name: "Australia" },
      { code: "NZ", name: "New Zealand" },
      { code: "IN", name: "India" },
      { code: "BR", name: "Brazil" },
      { code: "MX", name: "Mexico" },
      { code: "ZA", name: "South Africa" },
      { code: "KE", name: "Kenya" },
      { code: "GH", name: "Ghana" },
      { code: "AE", name: "United Arab Emirates" },
      { code: "SA", name: "Saudi Arabia" },
    ];
  }

  async getServices() {
    return [
      { id: "verify", name: "Verification (legacy)" },
      { id: "whatsapp", name: "WhatsApp" },
      { id: "telegram", name: "Telegram" },
      { id: "google", name: "Google" },
      { id: "facebook", name: "Facebook" },
      { id: "instagram", name: "Instagram" },
      { id: "tiktok", name: "TikTok" },
      { id: "twitter", name: "X / Twitter" },
      { id: "discord", name: "Discord" },
      { id: "uber", name: "Uber" },
      { id: "amazon", name: "Amazon" },
      { id: "sandbox", name: "Other services" },
    ];
  }

  async getPricing() {
    return [
      { serviceId: "verify", amount: 15000, currency: "NGN" as const },
      { serviceId: "whatsapp", amount: 15000, currency: "NGN" as const },
      { serviceId: "telegram", amount: 12000, currency: "NGN" as const },
      { serviceId: "google", amount: 18000, currency: "NGN" as const },
      { serviceId: "facebook", amount: 14000, currency: "NGN" as const },
      { serviceId: "instagram", amount: 14000, currency: "NGN" as const },
      { serviceId: "tiktok", amount: 16000, currency: "NGN" as const },
      { serviceId: "twitter", amount: 12000, currency: "NGN" as const },
      { serviceId: "discord", amount: 10000, currency: "NGN" as const },
      { serviceId: "uber", amount: 20000, currency: "NGN" as const },
      { serviceId: "amazon", amount: 20000, currency: "NGN" as const },
      { serviceId: "sandbox", amount: 8000, currency: "NGN" as const },
    ];
  }

  async buyActivation(input: {
    userId: number;
    country: string;
    serviceId: string;
  }) {
    const id = `activation_${Date.now()}_${input.userId}`;

    const prefixes: Record<string, string> = {
      NG: "+234 809 440 2186",
      US: "+1 202 555 0184",
      GB: "+44 7700 900123",
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

    const phoneNumber =
      prefixes[input.country] ?? "+1 202 555 0184";

    this.activations.set(id, {
      createdAt: Date.now(),
      cancelled: false,
      phoneNumber,
    });

    return {
      id,
      phoneNumber,
      status: "WAITING" as const,
    };
  }

  async getStatus(activationId: string) {
    const activation = this.activations.get(activationId);

    if (!activation || activation.cancelled) {
      return {
        id: activationId,
        status: "CANCELLED" as const,
      };
    }

    return Date.now() - activation.createdAt > 1500
      ? {
          id: activationId,
          status: "RECEIVED" as const,
          code: "482913",
        }
      : {
          id: activationId,
          status: "WAITING" as const,
        };
  }

  async cancelActivation(activationId: string) {
    const activation = this.activations.get(activationId);

    if (activation) {
      this.activations.set(activationId, {
        ...activation,
        cancelled: true,
      });
    }
  }
}
