# SUBBY VIRTUAL — Step 2 Release Report

## Release identity

The Step 2 end-to-end demo release is present on `origin/main` at commit `d30644d1643d89ccf9efe4146be5d7f073ef9a07`. The repository remains private at [olasubomi-png/SUBBY-VIRTUAL](https://github.com/olasubomi-png/SUBBY-VIRTUAL).

## Implemented changes

The release connects server-authoritative Demo Credits, replay-safe UUID idempotency, wallet ledger reads, mock SMS activation creation and simulated receipt completion, temporary mailbox creation, simulated email receipt, ownership checks, copy and refresh controls, visible expiry metadata, authenticated overview and transaction views, and protected admin review procedures. It adds the supporting `server/demoState.ts` service, end-to-end contract coverage in `server/e2e.demo.test.ts`, admin detail procedures in `server/routers.ts`, the PostgreSQL lifecycle fields and migration under `drizzle/`, and the managed migration boundary in `docs/DEPLOYMENT.md`.

## Validation

| Check | Result |
|---|---|
| `pnpm lint` | Passed; all formatted files matched Prettier |
| `pnpm check` | Passed; TypeScript emitted no errors |
| `pnpm test` | Passed; 8 test files and 20 tests |
| `pnpm build` | Passed; Vite client and bundled Node server produced successfully |
| UI verification | Passed for overview, SMS, mail, and wallet routes; protected workspace preview captured |
| Repository verification | Passed; `HEAD` and `origin/main` both point to `d30644d1643d89ccf9efe4146be5d7f073ef9a07` |

## Limitations and safe boundaries

The managed PostgreSQL migration attempt was rejected from the sandbox by an SSL/TLS connection error. The schema and generated SQL are committed, and `docs/DEPLOYMENT.md` records the safe apply path; operators must apply and verify the migration from a network location that can reach the managed PostgreSQL service. When PostgreSQL is unavailable, the demo uses an in-process server-side fallback so the local demo remains usable, but that fallback is not restart-persistent and must not be used for production balances.

SMS and email implementations remain mock-only. Payments, real-money wallet funding, live SMS delivery, live email delivery, and external provider credentials are disabled. The admin surface now has protected metrics and detail procedures for activations, inboxes, wallet ledgers, and audit records; a dedicated user-search interface remains a follow-on enhancement.
