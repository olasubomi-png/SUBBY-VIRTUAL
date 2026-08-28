# Paystack Payment Integration

## Pricing

1 Point = ₦500 = 50,000 kobo.

Paystack `amount` is always `points × 50000`, computed server-side from the package.

## Flow

1. User selects a **server-defined** Points package (`packageId` only).
2. Backend creates/reuses a `pointTopUpIntents` row (idempotent).
3. Backend initializes Paystack with secret key (server-side only).
4. User is redirected to Paystack `authorization_url`.
5. Paystack webhook `POST /api/payments/paystack/webhook` arrives.
6. Server verifies **HMAC SHA512** signature on the **raw body**.
7. Server **re-verifies** the transaction via Paystack Verify API.
8. Amount and currency must match the intent exactly.
9. Points are credited **once** (ledger reference `topup-credit-{topUpId}`).

Browser redirects are **not** trusted as proof of payment.

## Environment

```bash
PAYMENT_PROVIDER=mock|paystack
PAYSTACK_SECRET_KEY=sk_test_...   # or sk_live_...
PAYSTACK_PUBLIC_KEY=pk_test_...
APP_URL=https://subomivirtual.kdns.fr
# Webhook URL (configure in Paystack dashboard):
# https://subomivirtual.kdns.fr/api/payments/paystack/webhook
```

Incomplete paystack config **fails closed** (no silent mock fallback).

## Dashboard configuration

1. Create a Paystack account.
2. Copy test keys for staging; live keys only for production.
3. Settings → API Keys & Webhooks → add webhook URL above.
4. Subscribe at least to `charge.success`.
5. Set callback URL to `https://subomivirtual.kdns.fr/wallet?payment=return`.

## Security

- Secret key never sent to the browser.
- Webhook signature required.
- Amount/currency checked against stored intent.
- Unique ledger reference prevents double credit.
- Users can only query their own top-ups.

## Mock mode

`PAYMENT_PROVIDER=mock` is for tests and local development only.
