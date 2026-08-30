# SUBBY VIRTUAL — Canonical money model

## Units

| Name | Meaning |
|------|---------|
| NGN kobo | **Wallet ledger unit** (1/100 naira) |
| Points | **Top-up package size only** (1 Point = 50_000 kobo = ₦500) |
| Paystack amount | Kobo (same as wallet) |

## Identities

```
1 Point package  = ₦500 = 50_000 kobo
Wallet balance   = NGN kobo
SMS debit        = retailPriceMinor (kobo) — exact, no ceil-to-₦500
Paystack amount  = package.points × 50_000 kobo
```

## Top-up

Customer pays Paystack kobo → ledger CREDIT of the **same kobo amount**.

## SMS

```
provider cost → FX → kobo → ×1.48 ceil → retail kobo → wallet DEBIT (same kobo)
```

Displayed ₦ and debited ₦ are identical.

## Gross margin

```
grossMarginKobo = retailPriceMinor − providerCostMinor
```

Not net of Paystack fees.
