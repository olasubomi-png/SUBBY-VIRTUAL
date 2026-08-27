# SUBBY VIRTUAL — Step 2 Release Report

## Release identity

The Step 2 end-to-end demo release is present on `origin/main` at commit `d30644d1643d89ccf9efe4146be5d7f073ef9a07`. The repository remains private at [olasubomi-png/SUBBY-VIRTUAL](https://github.com/olasubomi-png/SUBBY-VIRTUAL).

## Implemented changes

The release connects server-authoritative Demo Credits, replay-safe UUID idempotency, wallet ledger reads, mock SMS activation creation and simulated receipt completion, temporary mailbox creation, simulated email receipt, ownership checks, copy and refresh controls, visible expiry metadata, authenticated overview and transaction views, and protected admin review procedures. It adds the supporting `server/demoState.ts` service, end-to-end contract coverage in `server/e2e.demo.test.ts`, admin detail procedures in `server/routers.ts`, the PostgreSQL lifecycle fields and migration under `drizzle/`, and the managed migration boundary in `docs/DEPLOYMENT.md`.

## Validation

| Check                   | Result                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm lint`             | Passed; all formatted files matched Prettier                                              |
| `pnpm check`            | Passed; TypeScript emitted no errors                                                      |
| `pnpm test`             | Passed; 8 test files and 20 tests                                                         |
| `pnpm build`            | Passed; Vite client and bundled Node server produced successfully                         |
| UI verification         | Passed for overview, SMS, mail, and wallet routes; protected workspace preview captured   |
| Repository verification | Passed; `HEAD` and `origin/main` both point to `d30644d1643d89ccf9efe4146be5d7f073ef9a07` |

## Limitations and safe boundaries

The managed PostgreSQL migration attempt was rejected from the sandbox by an SSL/TLS connection error. The schema and generated SQL are committed, and `docs/DEPLOYMENT.md` records the safe apply path; operators must apply and verify the migration from a network location that can reach the managed PostgreSQL service. When PostgreSQL is unavailable, the demo uses an in-process server-side fallback so the local demo remains usable, but that fallback is not restart-persistent and must not be used for production balances.

SMS and email implementations remain mock-only. Payments, real-money wallet funding, live SMS delivery, live email delivery, and external provider credentials are disabled. The admin surface now has protected metrics and detail procedures for activations, inboxes, wallet ledgers, and audit records; a dedicated user-search interface remains a follow-on enhancement.

## Continuation updates

The continuation pass added server-validated SMS cancellation, invalid-state rejection after completion or cancellation, mailbox expiration, and rejection of simulated mail after expiry. Customer request cards now provide selectable server-backed detail status, visible loading/error feedback, and lifecycle controls. Admin activation and inbox procedures redact message bodies by default and expose only safe metadata, counts, and message-presence indicators. The final validation run passed `pnpm lint`, `pnpm check`, `pnpm test` with 22 tests, and `pnpm build`.

## Final continuation pass

The customer request workspace now exposes a dedicated server-backed detail surface with resource ID, server status, created time, and expiry metadata. SMS creation, simulation, cancellation, mailbox creation, email simulation, and mailbox expiration each provide action-specific success feedback, while query and mutation failures render a safe error banner. Admin inbox and activation detail procedures redact message bodies by default. The final validation run passed `pnpm lint`, `pnpm check`, `pnpm test` with 23 tests, and `pnpm build`.

# Final Phase 1 Continuation Report

## Files changed

The continuation pass changed `server/demoState.ts`, `server/routers.ts`, `server/routers.test.ts`, `server/e2e.demo.test.ts`, `client/src/pages/Home.tsx`, `docs/DEPLOYMENT.md`, `docs/STEP2_RELEASE.md`, and `todo.md`. The existing PostgreSQL schema, generated migration, provider contracts, job primitives, and security modules remain part of the release.

## Implemented features

The existing product direction was preserved: authenticated communications testing with mock SMS, temporary demo mail, Demo Credits, auditable activity, protected administration, and a dark mobile-first command center. The pass added validated SMS cancellation, invalid post-completion rejection, mailbox expiration, post-expiry email rejection, mailbox copy/refresh/expiry controls, selectable request details, action-specific success feedback, safe error banners, and protected admin resource-review procedures.

## Database and schema

The PostgreSQL/Drizzle schema and generated incremental migration remain the persistent target for wallet, ledger, activation, mailbox, message, email, provider, support, and audit records. The managed migration was not applied because the sandbox could not establish the provider's TLS connection; this boundary and the safe local/VPS apply commands are documented in `docs/DEPLOYMENT.md`.

## API and tRPC changes

Protected workspace procedures now cover summary, wallet, ledger, Demo Credits, SMS options and requests, SMS detail, SMS simulation, SMS cancellation, mail inboxes, mail detail, email simulation, and inbox expiration. Protected admin procedures cover overview metrics, redacted activation and inbox review, wallet ledgers, and paginated audit history. Server-side ownership, RBAC, input validation, rate limits, state transitions, and safe error paths are retained.

## Frontend changes

`client/src/pages/Home.tsx` now reflects authenticated tRPC state for overview, wallet, transactions, SMS, mail, and admin views. Request cards open a dedicated inline detail surface showing resource ID, server status, created time, and expiry where applicable. Create, simulate, cancel, and expire operations report distinct success messages; query and mutation failures render a safe error message.

## Tests added or updated

The test suite includes authentication/logout behavior, protected access rejection, invalid SMS/mail/detail/admin inputs, wallet integrity, duplicate-credit protection, insufficient balance, provider health, RBAC, Redis fallback, cleanup expiry, SMS and mail lifecycle behavior, cross-user ownership isolation, admin review, request cancellation, invalid state transitions, and end-to-end Demo Credit/SMS/mail flows.

## Commands executed and results

The final validation used `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build`. All passed. The final run reported 8 test files and 23 passing tests, TypeScript with no errors, Prettier validation clean, and successful Vite plus Node-server production bundles.

## Remaining Phase 1 work

The managed PostgreSQL migration still requires application from a network location that can reach the database over the provider-required TLS configuration. Until that is completed, the local demo uses a server-side in-process fallback that is suitable for testing but not for production balances or restart persistence. Live SMS, live email receiving, payment processing, real-money purchases, and external provider credentials remain intentionally disabled. A dedicated admin user-search interface and full persistent message storage remain follow-on work.

## Persistent message storage continuation

The message-storage pass completed the existing PostgreSQL/Drizzle model rather than introducing parallel tables. SMS and email message rows now carry stable provider-facing identifiers, recipient metadata, source classification, and UTC receipt timestamps. SMS activation and temporary inbox records also have stable external IDs, with uniqueness constraints preventing duplicate parent resources and one simulated message per activation. The repository helpers perform ownership-scoped reads, duplicate checks, and idempotent inserts; simulated completion uses the durable message row as the source of truth whenever `DATABASE_URL` is a PostgreSQL endpoint.

Customer list and detail procedures now read persistent activation, inbox, SMS-message, and mail-message records in PostgreSQL mode. Cancellation and expiry transitions also update the durable parent rows with ownership checks. When PostgreSQL is not configured, the same procedures intentionally use the existing in-process fallback so local development remains usable; that fallback is not restart-persistent and is not suitable for production balances or message history.

The generated additive migration is `drizzle/migrations/0003_persistent_messages.sql`. It adds the message metadata columns, stable external-ID columns, and uniqueness constraints without recreating existing tables. The managed SQL console currently reports a TiDB/MySQL dialect and rejects PostgreSQL `ALTER TABLE` syntax, so the migration was not applied through that endpoint. Operators must apply the committed PostgreSQL migration against the actual PostgreSQL deployment target, then verify the columns and constraints before enabling durable mode.

Coverage now includes controlled persistence-helper tests for SMS and email metadata inserts, duplicate simulation rejection for both mock channels, ownership and lifecycle failures, fallback behavior, admin redaction, and input validation. The final local validation passed `pnpm lint`, `pnpm check`, `pnpm test` with 25 tests, and `pnpm build`. Real SMS, real email, payments, and external provider credentials remain disabled.

### Exact files changed in this pass

The persistent message-storage continuation changed the following files: `drizzle/schema.ts`; `drizzle/0004_great_devos.sql`; `drizzle/meta/_journal.json`; `drizzle/meta/0004_snapshot.json`; `server/persistence.ts`; `server/persistence.test.ts`; `server/routers.ts`; `server/demoState.ts`; `server/e2e.demo.test.ts`; `docs/STEP2_RELEASE.md`; and `todo.md`. The migration is additive only: it adds `externalId` to `smsMessages` and `mailMessages` and adds unique constraints for those identifiers. Durable mode uses PostgreSQL/Drizzle repository transactions and ownership-scoped reads; development mode retains the in-memory fallback. Validation results are `pnpm lint` passed, `pnpm check` passed, `pnpm test` passed with 26 tests, and `pnpm build` passed. The only deployment limitation is that the configured managed SQL console identifies as TiDB/MySQL and rejected PostgreSQL syntax, so operators must apply the committed migration to the actual PostgreSQL target before relying on restart persistence.

## PostgreSQL production-readiness continuation

The readiness pass keeps PostgreSQL as the only durable database target and adds an explicit server-side persistence-mode contract. PostgreSQL URLs are classified separately from unsupported database URLs and the development fallback. Production database callers fail closed when PostgreSQL is absent, unsupported, or unavailable; local development may continue using the non-durable in-memory service. PostgreSQL connection initialization now validates a pooled `select 1`, uses bounded pool and connection timeouts, verifies remote TLS certificates, and emits only generic connection-failure diagnostics.

Wallet reads and Demo Credit/debit writes now use the PostgreSQL wallets and immutable integer-minor-unit ledger when durable mode is active. Workspace overview and wallet procedures use persistent records, and admin activation, inbox, and wallet-ledger review procedures use database-backed data with message-body redaction. A protected `admin.databaseHealth` procedure exposes only configured state, dialect, reachability, persistence mode, and a clearly labeled migration-state value; it never returns connection strings or credentials. The public `/health` endpoint remains a liveness check and does not claim database reachability.

The readiness pass added `server/persistenceMode.ts`, `server/db.test.ts`, `server/persistenceMode.test.ts`, and `server/migration.test.ts`, and extended `server/db.ts`, `server/persistence.ts`, `server/persistence.test.ts`, `server/routers.ts`, `server/routers.test.ts`, `docs/DEPLOYMENT.md`, `docs/STEP2_RELEASE.md`, and `todo.md`. The static migration contract confirms the PostgreSQL journal, snapshot, ordered migration sequence, message columns, unique constraints, and absence of destructive SQL. No real SMS, email, payment, or real-money funding functionality was enabled.

## Admin user-management continuation

The protected Admin Users area is now implemented in the existing console. It provides server-side `admin.users` search with trimmed ID/name/email input, deterministic creation-time/ID ordering, zero-based pagination, a maximum page size of 50, safe empty results, and the existing distributed admin rate limit. `admin.userDetail` provides safe account identity and status, wallet balance/credit/debit and recent ledger metadata, SMS status counts and message count, mailbox status/message counts, and recent audit metadata. The response intentionally omits open IDs, secrets, credentials, and message bodies.

The frontend adds an Admin Users search table with responsive horizontal overflow, loading/error/empty states, result counts, previous/next pagination, and a selected-user detail dashboard. The Admin console navigation is hidden for non-administrators and direct unauthorized navigation displays an access-restricted state; the server-side `adminProcedure` remains the enforcement boundary. In-memory fallback mode does not invent users: search returns an honest empty result and detail inspection requires PostgreSQL.

The persistent implementation changed `server/persistence.ts`, `server/routers.ts`, `server/routers.test.ts`, `server/adminUsersPersistence.test.ts`, `client/src/pages/Home.tsx`, `drizzle/schema.ts`, `drizzle/meta/_journal.json`, `drizzle/meta/0005_snapshot.json`, `drizzle/0005_closed_skullbuster.sql`, `server/migration.test.ts`, `docs/DEPLOYMENT.md`, `docs/STEP2_RELEASE.md`, and `todo.md`. Migration 0005 adds only B-tree indexes for email search, name search, and deterministic creation ordering. The actual PostgreSQL target must receive the migration before durable user search/detail data can be exercised; the managed TiDB/MySQL endpoint remains unsuitable for applying PostgreSQL migrations.

The Admin User Management evidence pass adds an explicit audit-metadata allowlist: only operational primitive fields such as mode, country, service, status, source, currency, counts, and result survive into user detail responses. Nested objects and sensitive keys are dropped. Persistence tests now seed multiple users and distinct pages, assert bounded page contents across page boundaries, verify ID/name/email search paths and empty results, and prove that a selected user’s detail excludes another user’s wallet, activity, SMS, mailbox, message, open-ID, token, password, and body data.

## Persistent job system and real-time activity continuation

The next architectural step is implemented in place as a minimal PostgreSQL-backed dispatcher, not a second queue framework. `jobs` stores a stable public reference, owner, validated job type, small resource-ID payload, lifecycle status, progress, attempts, retry deadline, lock metadata, timestamps, safe result, and safe error metadata. PostgreSQL claims use `FOR UPDATE SKIP LOCKED` and owner-scoped state transitions so duplicate workers cannot process the same queued job concurrently. The request-driven worker is exposed through cron-authenticated `POST /api/scheduled/dispatch-jobs`; no in-process timer or live provider worker was introduced.

Supported jobs are `MOCK_SMS_DELIVERY`, `DEMO_EMAIL_SIMULATION`, `MAILBOX_EXPIRY`, and `ACTIVATION_EXPIRY`. They call the existing mock-only lifecycle helpers and accept only validated resource IDs. Retry behavior is bounded to five attempts maximum, retries only errors classified as transient, caps backoff at 30 seconds, records safe failure codes, and permanently fails domain errors. Owners can cancel queued or retrying jobs only; processing, completed, failed, and cancelled jobs reject cancellation.

Job lifecycle events reuse the existing `auditLogs` table with safe metadata for creation, queueing, processing, progress, retry, completion, failure, and cancellation. Authenticated users have `workspace.jobs.create`, `workspace.jobs.list`, `workspace.jobs.detail`, `workspace.jobs.activity`, and `workspace.jobs.cancel`. Administrators have `admin.jobs.metrics`, `admin.jobs.list`, `admin.jobs.activity`, and `admin.jobs.dispatch`, with bounded pagination and redacted payload/result/activity fields. The frontend adds a Jobs / Activity area with server-backed mock queue actions, controlled five-second refresh, progress and status views, activity timeline, detail errors, and eligible cancellation. The Admin console adds aggregate job metrics, status filters, recent jobs, recent activity, and a bounded dispatch control.

The database change is additive: `drizzle/0006_smooth_dust.sql` creates the `jobs` table and owner/status claim indexes, with corresponding Drizzle journal and snapshot metadata. In PostgreSQL mode jobs and lifecycle audit records are durable across restarts. The fallback store is explicitly in-memory and non-durable. The managed SQL endpoint available during development reports TiDB/MySQL and cannot verify or apply this PostgreSQL migration; actual PostgreSQL persistence remains deployment-dependent.

The new job-system test suite covers supported job creation, mock SMS and email completion, ownership isolation, queued cancellation, invalid transitions, bounded retries, permanent failure, duplicate worker claims, safe payload validation, activity records, bounded listing, and router authentication/input validation. The project’s existing validation suite remains in place and must be rerun before release checkpointing.

### Exact files changed in the job-system pass

The job-system pass changed `drizzle/schema.ts`; `drizzle/0006_smooth_dust.sql`; `drizzle/meta/_journal.json`; `drizzle/meta/0006_snapshot.json`; `server/jobTypes.ts`; `server/jobState.ts`; `server/jobsCleanup.ts`; `server/jobs.ts`; `server/demoState.ts`; `server/persistence.ts`; `server/routers.ts`; `server/_core/index.ts`; `server/jobSystem.test.ts`; `server/migration.test.ts`; `client/src/pages/Home.tsx`; `docs/DEPLOYMENT.md`; `docs/STEP2_RELEASE.md`; and `todo.md`.

## Phase 1 job integration and reliability hardening

SMS and email simulation mutations are now queue-authoritative. The protected tRPC procedures validate ownership and active resource state, then return a stable job reference instead of executing delivery inline. Repeated requests for the same user/resource return the same job, so a retry cannot create a second simulated message. The existing worker remains the only path that invokes the mock SMS and mail lifecycle helpers.

Stale `PROCESSING` jobs are recovered before scheduled dispatch. A compare-and-set transition returns jobs to `RETRYING` with bounded backoff when attempts remain, or moves them to `FAILED` with a safe timeout code after the retry budget is exhausted. Recovery clears lock metadata, increments `recoveryCount`, records `lastRecoveredAt`, and writes `job.stale_recovered` or `job.stale_failed` audit activity. The fallback store applies the same policy for local development; it remains non-durable.

Worker startup is explicit and platform-compatible. The server health response reports a ready scheduled dispatcher, and startup logs identify `/api/scheduled/dispatch-jobs` as the execution path. There is no in-process timer worker. Concurrent dispatch requests share an in-flight guard, while PostgreSQL claims remain atomic through `FOR UPDATE SKIP LOCKED`; this prevents duplicate dispatcher loops and duplicate job claims without changing the existing queue architecture.

The additive recovery migration is `drizzle/0007_modern_eternals.sql`. It adds only `recoveryCount` and `lastRecoveredAt` to `jobs`. The configured development SQL endpoint still reports TiDB/MySQL and rejected the PostgreSQL migration syntax, so the migration must be applied to the actual PostgreSQL target before relying on restart-persistent recovery metadata.

Coverage now includes queued SMS/email tRPC contracts, duplicate simulation requests, stale retry and exhausted-failure recovery, concurrent dispatch guarding, atomic fallback claims, and the existing persistence, authorization, privacy, and lifecycle suite. The current local validation run passed `pnpm check` and `pnpm test` with 58 tests; lint, production build, checkpoint, and GitHub synchronization remain release steps.

### Exact files changed in this hardening pass

This hardening pass changed `drizzle/schema.ts`; `drizzle/0007_modern_eternals.sql`; `drizzle/meta/_journal.json`; `drizzle/meta/0007_snapshot.json`; `server/jobState.ts`; `server/persistence.ts`; `server/jobs.ts`; `server/routers.ts`; `server/_core/index.ts`; `server/e2e.demo.test.ts`; `server/jobSystem.test.ts`; `server/migration.test.ts`; `client/src/pages/Home.tsx`; `docs/STEP2_RELEASE.md`; and `todo.md`.

## Hardened release identity

The Phase 1 hardened release is checkpointed as `83de23b97d18ec54ea2bfd7540f3ce9bc6cdb7f1`. Local `HEAD` and `origin/main` match this SHA, and the public repository is [olasubomi-png/SUBBY-VIRTUAL](https://github.com/olasubomi-png/SUBBY-VIRTUAL) on its `main` branch.

## Final Phase 1 release verification and closure

The closure audit inspected the active repository, package scripts, lockfile, server, client, shared contracts, Drizzle schema and migration journal, Docker Compose, deployment and environment guidance, tests, TODO history, and public GitHub `main`. It confirmed that the current production target remains PostgreSQL, while an absent database URL is an explicitly non-durable development fallback and an unsupported dialect is rejected. The managed development endpoint identifies as TiDB/MySQL and is therefore not treated as PostgreSQL evidence or a migration target.

The audit verified the queue-authoritative SMS and demo-email flows, bounded supported job types, ownership checks, redacted job data, PostgreSQL atomic claims using `FOR UPDATE SKIP LOCKED`, duplicate-dispatch guarding, stale-processing recovery, bounded retries, cancellation guards, and safe audit activity. The source scan found no committed environment files, live-provider credentials, arbitrary execution primitives, or server-side timer worker. Administrator operations remain server-side RBAC protected.

Three small release defects were corrected without expanding scope: the unauthenticated workspace now resolves to a protected sign-in experience rather than leaving a spinner after a `401`; the sign-out control now calls the shared logout operation; and unreachable hard-coded request UI was removed. The support-ticket control now honestly identifies ticket intake as unavailable in Phase 1. Cron-only cleanup and dispatch callbacks now return generic failure messages rather than relaying raw exception text.

The final local validation on 2026-08-27 passed `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build`. Vitest reported 14 passing files and 63 passing tests. The production build completed successfully, with a non-blocking client-chunk-size warning for a minified bundle over 500 kB. Drizzle metadata is ordered from `0000_regular_daredevil` through `0007_modern_eternals`; the latest additive migration adds only `jobs.recoveryCount` and `jobs.lastRecoveredAt`, matching the schema and snapshot.

Phase 1 is code-complete at closure. Before a durable production launch, operators must apply migrations through `0007` to an actual PostgreSQL service, configure the deployed cron-only cleanup and dispatch callbacks, and perform the documented restart-persistence verification. Real SMS/email providers, payments, real-money funding, arbitrary execution, customer support ticket intake, and bundle-splitting optimization remain intentional follow-on work rather than part of this Phase 1 release.

## Phase 1 VPS deployment readiness

The repository now includes a standard Linux VPS preparation path without deploying the application or altering the Phase 1 mock-only domain behavior. `pnpm start` remains the sole production entry point and PM2 runs that compiled process once through `ecosystem.config.cjs`. Production defaults to `HOST=127.0.0.1` and a strict configured `PORT`, so Nginx, rather than the application process, owns public HTTPS exposure. Express trusts one proxy hop only in production, and `/health` returns safe database-mode/reachability and dispatcher-readiness fields.

The new `deploy/env.example` is credential-free, `.env.*` files are ignored, and `deploy/nginx/subby.kdns.fr.conf` provides the pre-Certbot HTTP reverse-proxy bootstrap for `subby.kdns.fr`. `docs/VPS_DEPLOYMENT.md` documents PostgreSQL role/database setup, migration application through `0007`, PM2 operation, Nginx, Certbot, UFW, health checks, authenticated scheduled-dispatch prerequisites, smoke tests, update, and rollback. It does not claim a VPS, DNS record, TLS certificate, production migration, scheduler connection, or restart-persistence verification exists.

Repository validation passed `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build`. The suite now contains 69 tests in 16 passing files, including focused runtime-binding and VPS-artifact tests. A local compiled-production smoke run confirmed loopback-only binding and a safe `/health` response; its configured TiDB/MySQL-compatible development endpoint was correctly reported as unsupported rather than treated as PostgreSQL evidence.
