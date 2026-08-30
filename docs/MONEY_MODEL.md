# SUBBY VIRTUAL — Canonical money model

## Units

| Name | Meaning | Where used |
|------|---------|------------|
| NGN major | Whole naira (₦1) | UI labels |
| NGN kobo | 1/100 naira | Paystack `amount`, SMS `retailPriceMinor`, `providerCostMinor` after FX |
| Points | User wallet unit | Ledger `amountMinor`, balances, SMS debit |
| Provider major | Provider currency major (often USD) | SMSBulk/SMS-Activate price quotes |
| Provider cents | Provider major × 100 | Intermediate FX math |

## Authoritative identities

```
1 Point  = ₦500 NGN = 50_000 kobo
1 ledger amountMinor  = 1 Point
Paystack amountMinor  = kobo  (points × 50_000)
```

**These are not interchangeable.** A variable named `amountMinor` may mean kobo (Paystack) or points (wallet ledger). Always check the call site.

## Paystack top-up

```
package.points  →  Paystack amount = points × 50_000 kobo
                →  webhook verifies amount + reference
                →  ledger CREDIT of package.points (not kobo)
```

Example: 2 Points package → customer pays ₦1,000 → wallet +2 Points.

## SMS purchase (wallet-first)

```
provider cost (major)
  → FX → providerCostMinor (kobo)
  → × (1 + SMS_MARKUP_BPS/10000) ceil → retailPriceMinor (kobo)
  → points = ceil(retailKobo / 50_000)
  → ledger DEBIT of points
```

Default markup: **4800 BPS = 48%**.

Orders snapshot: `quotedPriceMinor` (**points debited**), `providerCostMinor` (kobo), `markupBps`, `pricingVersion`.

## Economic relationship

Top-up and SMS share the same Point denomination (₦500/pt).

Displayed SMS retail is in **naira/kobo**; the **wallet charge is whole Points** via ceil.  
Therefore a ₦148 retail number still costs **1 Point (₦500 equivalent)**.

This never undercharges the platform; the UI must show **points required** so the customer is not surprised by the ceil.

## Gross vs net profit

```
grossProfit (kobo) = retailPriceMinor − providerCostMinor
```

Paystack fees are **not** subtracted in the current model. Label this **gross margin**, not net profit.

## Production markup

Set on the VPS (never commit secrets):

```
SMS_MARKUP_BPS=4800
```

Code default is also 4800 if the variable is unset. PM2 does not embed markup in `ecosystem.config.cjs`; it comes from the process environment / `.env`.
