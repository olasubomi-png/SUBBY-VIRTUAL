# SUBBY Points Wallet

## Denomination

```
1 SUBBY Point = ₦500 NGN = 50,000 kobo
```

Used for top-up packages and converting SMS retail NGN prices into Points charged.

## SMS activation pricing (dynamic)

SMS prices are **not** fixed at ₦500.

```
provider cost (live)
  → NGN kobo (FX)
  → + SMS_MARKUP_BPS
  → retail kobo
  → points charged = ceil(retailKobo / 50_000)
```

Orders snapshot `quotedPriceMinor` (Points debited), `providerCostMinor`, `markupBps`, `pricingVersion`.

## Top-ups

Packages still use `points × 50,000` kobo for Paystack amounts.
