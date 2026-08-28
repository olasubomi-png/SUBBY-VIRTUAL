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

- Client/server may call `workspace.pollSms` once per check (bounded).
- No unbounded background poll loops.
- Duplicate code events are idempotent via the existing lifecycle.

Webhook support is not required for this adapter. A future provider that supports signed webhooks can be added without rewriting order logic.

## Billing

- Server-side catalog prices only (never trust the client).
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
- Pricing for external mode currently reuses the internal NGN catalog table for billing consistency; live provider retail prices may differ from catalog quotes.
- No payment-gateway integration in this step.
