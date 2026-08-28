# SUBBY Points Wallet

## What are SUBBY Points?

**SUBBY Points** are the user-facing billing unit for SUBBY VIRTUAL.

```
1 SUBBY Point = 1 virtual number / SMS activation
1 SUBBY Point = ₦500 NGN = 50,000 kobo
```

Ledger representation: **1 Point = 1 integer ledger unit**.

## Examples

| Points | NGN | Paystack kobo | Activations |
|--------|-----|---------------|-------------|
| 1 | ₦500 | 50,000 | 1 |
| 5 | ₦2,500 | 250,000 | 5 |
| 10 | ₦5,000 | 500,000 | 10 |
| 20 | ₦10,000 | 1,000,000 | 20 |
| 100 | ₦50,000 | 5,000,000 | 100 |

## SMS billing

Each successful billable activation debits **exactly 1 Point**.

Failed allocation refunds **1 Point** once (idempotent reference).

Provider cost is internal only and is not charged to the user as variable pricing.

## Architecture

PostgreSQL `walletLedgerEntries` is the sole source of truth for balances.

## Top-ups

Server packages (`pts_1` … `pts_100`) compute Paystack amount as `points × 50_000` kobo.

Clients send only `packageId` + `idempotencyKey`.

## Out of scope documentation

Never document real Paystack secrets.
