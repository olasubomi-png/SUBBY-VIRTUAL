# SUBBY Points Wallet

## What are SUBBY Points?

**SUBBY Points** are the user-facing billing unit for SUBBY VIRTUAL.

```
1 SUBBY Point = 1 wallet ledger minor unit (integer)
```

Existing balances and SMS prices that were stored as integer minor units map **1:1** into Points. No floating-point arithmetic is used.

## Architecture

```
Authoritative source of truth
  └── PostgreSQL walletLedgerEntries (immutable append-only ledger)
        └── Balance = Σ credit-like − Σ debit-like

Display / API
  └── points = balanceMinor (identity)
```

Redis/frontend caches must never authorize spending.

## Ledger entry types

| Type | Balance effect |
|------|----------------|
| `CREDIT` | + |
| `DEBIT` | − |
| `REFUND` | + |
| `ADMIN_ADJUSTMENT` | + or − via `direction` |

Every entry has a unique `reference` for idempotency.

## SMS billing

1. Server resolves catalog retail price (integer points).
2. Snapshot on the order (`quotedPriceMinor` = points charged).
3. Atomic debit with idempotency key.
4. Provider allocation; on failure → `REFUND` with deterministic reference `sms-refund-{userId}-{idempotencyKey}`.

Clients cannot submit price or points.

## Top-up intents

Table `pointTopUpIntents` supports future payment providers:

Statuses: `pending` → `processing` → `completed` | `failed` | `cancelled`

**No payment gateway in this step.** Frontend cannot mark a top-up completed. Only a verified server-side completion path (fixture/tests today; webhook later) credits points.

## Admin adjustments

`admin.adjustPoints` requires admin auth, reason, direction, and idempotency key. Writes `ADMIN_ADJUSTMENT` + audit log.

## Migration

Production balances already stored as integer minor units. Presentation changes to Points with **1:1** mapping. No balance wipe or rescale. Schema adds ledger `direction` / `actorUserId` and `pointTopUpIntents` (additive migration `0011`).

## Out of scope

Paystack, Stripe, Flutterwave, crypto, cards, bank transfer, subscriptions.
