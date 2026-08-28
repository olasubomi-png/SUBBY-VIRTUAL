# SMS Provider Architecture

SUBBY VIRTUAL separates **demo** and **production** SMS providers behind one interface.

## Modes

| Mode | Env | Implementation |
|------|-----|----------------|
| **Demo** | `SMS_PROVIDER=mock` (default) | `MockSMSProvider` — local simulated numbers and codes |
| **Production** | `SMS_PROVIDER=external` | `ExternalSmsProvider` — SMS-Activate-compatible HTTP API |

Incomplete external configuration **fails closed**. The app never silently falls back to mock after `SMS_PROVIDER=external` is selected.

## Environment variables

```bash
SMS_PROVIDER=mock|external
SMS_PROVIDER_BASE_URL=https://api.example.com/stubs/handler_api.php
SMS_PROVIDER_API_KEY=your-provider-api-key
SMS_PROVIDER_API_SECRET=   # optional / unused by the SMS-Activate adapter
SMS_MAX_PROVIDER_COST_NGN=  # optional NGN major ceiling for upstream cost
```

Placeholders only — never commit real credentials.

## Provider contract

All providers implement:

- `getCountries` / `getServices` / `getPricing`
- `buyActivation` → phone number + **provider reference id**
- `getStatus` → waiting / received(+code) / cancelled
- `cancelActivation`
- `healthCheck`

Application lifecycle remains authoritative:

`pending → allocating → active → code_received → completed`  
Terminal: `cancelled | expired | failed`

Provider statuses are **mapped** into these states; they do not replace them.

## Verification codes

The SMS-Activate-compatible API uses **polling** (`getStatus`), not webhooks.

- Client may call `workspace.pollSms` once per check (bounded).
- Server queues a bounded `SMS_STATUS_POLL` job (max 20 attempts) after allocation.
- No unbounded per-user timers or infinite loops.
- Duplicate code events are idempotent via the existing lifecycle.

Webhook support is not required for this adapter. A future provider that supports signed webhooks can be added without rewriting order logic.

## Live catalog (external mode)

External mode loads prices via the provider `getPrices` action and normalizes them into SUBBY catalog entries (country, service, availability, retail price).

- Unmapped provider countries/services are skipped (not fabricated).
- `count = 0` → unavailable (purchase rejected).
- Catalog cache TTL: **60 seconds**.
- Cache is provider-isolated; force refresh available for admin/ops.
- Refresh failure fails closed (no mock fallback, no invented prices).

## Pricing model

```
provider major cost
  → integer provider cents (2 d.p., ceil residuals)
  → wallet minor via SMS_FX_MINOR_PER_PROVIDER_MAJOR (ceil)
  → retail = cost × (10000 + SMS_MARKUP_BPS) / 10000 (ceil)
```

- `SMS_MARKUP_BPS` — basis points (1000 = 10%). Default 0.
- `SMS_FX_MINOR_PER_PROVIDER_MAJOR` — wallet minor units per 1.00 provider major (default 160000).
- Ordinary users see **retail** only; provider cost is internal.
- Each order snapshots `quotedPriceMinor`, `providerCostMinor`, `pricingVersion`, `markupBps`.

## Billing

- Server-side catalog prices only (never trust the client).
- Purchase re-resolves catalog at submit time (not the UI display).
- Atomic debit + order create with idempotency key.
- Allocation failure → order `failed` + **refund** of the debit (idempotent refund reference).
- Cancellation uses existing financial rules; provider release is best-effort.

## Security

- API keys exist only in server environment variables.
- Keys are never returned in API responses or stored on SMS order rows.
- Provider references (activation ids) may be stored; secrets must not.
- Logs must not include `api_key` query values (redaction helper on the adapter).
- Cross-user access remains ownership-checked.

## Operational prerequisites

1. SMS-Activate-compatible account and API key.
2. Funded provider balance.
3. Set `SMS_PROVIDER=external` plus base URL and API key on the server.
4. Restart the Node process after env changes.
5. Confirm `admin.providerHealth` reports `ok: true` before serving live traffic.

## Failure behavior

| Condition | Result |
|-----------|--------|
| Missing external config | Startup/request error — no mock fallback |
| No numbers | Safe client error; order failed + refund |
| Auth failure | Safe client error; order failed + refund |
| Timeout / 5xx | Safe client error; retryable at provider layer |
| Malformed body | Rejected; order failed + refund |

## Limitations

- Single external adapter in this step (SMS-Activate-compatible).
- External retail prices are derived from live provider costs + markup; mock mode keeps the static demo catalog.
- No payment-gateway integration in this step.


## Production setup (SMS-Activate-compatible)

1. Obtain an API key from an SMS-Activate-compatible provider.
2. Set on the VPS (never commit):

```bash
SMS_PROVIDER=external
SMS_PROVIDER_BASE_URL=https://api.sms-activate.ae/stubs/handler_api.php
SMS_PROVIDER_API_KEY=your_key_here
```

3. Restart the Node process / PM2.
4. Confirm `admin.providerHealth` reports SMS reachable.
5. Keep `SMS_PROVIDER=mock` for automated tests and local demo.

### Credentials required

| Variable | Purpose |
|----------|---------|
| `SMS_PROVIDER` | `mock` or `external` |
| `SMS_PROVIDER_BASE_URL` | Provider handler API URL |
| `SMS_PROVIDER_API_KEY` | Server-side API key |

Optional: `SMS_PROVIDER_API_SECRET` (unused by SMS-Activate adapter).


## Maximum provider-cost protection

`SMS_MAX_PROVIDER_COST_NGN` is an optional integer ceiling in **NGN major units**.

- Customer charge remains **1 Point = ₦500** regardless of upstream cost.
- Before calling `getNumber`, the server compares catalog `providerCostMinor` (kobo) to `SMS_MAX_PROVIDER_COST_NGN × 100`.
- If the ceiling is set and provider cost is **unknown**, allocation fails closed (does not invent a price).
- If cost exceeds the ceiling → `PROVIDER_COST_EXCEEDED` (non-retryable for that quote).

## Handler protocol (SMS-Activate-compatible)

| Action | Success shape | Notes |
|--------|---------------|-------|
| `getBalance` | `ACCESS_BALANCE:<amount>` | Health + balance |
| `getPrices` | JSON country→service cost/count | Live catalog |
| `getNumber` | `ACCESS_NUMBER:<id>:<phone>` | Allocation |
| `getStatus` | `STATUS_WAIT_CODE` / `STATUS_OK:<code>` / `STATUS_CANCEL` | OTP poll |
| `setStatus` | `ACCESS_*` | status=8 cancel, status=6 complete |

## Safe production deployment

1. Keep `SMS_PROVIDER=mock` until keys are ready.
2. Set `SMS_PROVIDER_BASE_URL` and `SMS_PROVIDER_API_KEY` on the VPS only.
3. Optionally set `SMS_MAX_PROVIDER_COST_NGN` (e.g. `400`).
4. Switch `SMS_PROVIDER=external`.
5. Restart the process; verify admin provider health.
6. Never commit real API keys.
