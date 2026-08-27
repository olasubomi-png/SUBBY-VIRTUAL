# Deployment

Use Node.js 22 or newer, pnpm, and Docker Compose. On an Ubuntu VPS, clone the public repository, install dependencies with `pnpm install`, start private infrastructure with `docker compose up -d`, generate/apply PostgreSQL migrations with `DATABASE_URL=postgresql://... pnpm drizzle-kit migrate`, verify with `pnpm check && pnpm lint && pnpm test && pnpm build`, and run the compiled server with `pnpm start`. The health endpoint is `GET /health`; the Node process closes its database pool, Redis client, and HTTP server on SIGTERM/SIGINT.

Set `DATABASE_URL` to the PostgreSQL connection string and `REDIS_URL` to the private Redis connection string. PostgreSQL and Redis should remain on the internal Docker network or localhost; do not publish their ports to the public internet. Configure a TLS reverse proxy in front of the Node process.

For recurring cleanup, deploy first, then register the platform-managed callback: `manus-heartbeat create --name subby-cleanup --cron "0 */5 * * * *" --path /api/scheduled/cleanup --description "Expire demo inboxes and stale mock activations"`. The callback is cron-only and idempotent; it does not run from an in-process timer.

Secrets belong in the deployment secret manager. The runtime must not contain production SMS, email, or payment credentials because those integrations are deliberately deferred.

## Step 2 migration boundary

The Step 2 schema is defined in `drizzle/schema.ts`, and Drizzle generates PostgreSQL migrations under `drizzle/`. Generate and review migrations with `DATABASE_URL=... pnpm drizzle-kit generate` before applying them. The managed sandbox database rejected the attempted migration with an SSL/TLS connection error, so no claim is made that the incremental lifecycle columns are applied to the managed instance. Apply the reviewed SQL from a network location that can reach the PostgreSQL service, using the provider's required TLS settings, then verify the columns and Drizzle migration journal before enabling persistent lifecycle reads and writes.

For local development, use the PostgreSQL service from `docker-compose.yml` and run `DATABASE_URL=postgresql://subby:subby_dev_password@localhost:5432/subby pnpm drizzle-kit migrate`. Do not disable TLS against a remote production database; only local loopback connections use the non-TLS path in the application pool.

## PostgreSQL production-readiness runbook

The durable database dialect is **PostgreSQL** and the application uses `drizzle-orm/node-postgres`. Use PostgreSQL 14 or newer in production. Set `DATABASE_URL` only in the server-side deployment secret manager; never prefix it with `VITE_`, place it in client code, or expose it through browser configuration. The application recognizes `postgres://` and `postgresql://` URLs. An absent URL is a development fallback only; an unsupported URL or absent URL in production fails closed when a protected persistence procedure is invoked instead of silently switching production traffic to memory.

From a network location that can reach the actual PostgreSQL service, install dependencies and generate the migration only when the schema has changed:

```sh
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require' pnpm drizzle-kit generate
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require' pnpm drizzle-kit migrate
```

Review the generated SQL before applying it. For the current message-storage release, the reviewed additive migration is `drizzle/0004_great_devos.sql`; it adds nullable stable `externalId` columns and unique constraints to `smsMessages` and `mailMessages`. Confirm that `drizzle/meta/_journal.json`, the numbered snapshots, the SQL migration, and `drizzle/schema.ts` have the same ordered migration sequence. Do not edit historical migrations to repair a later schema change.

After migration, verify the target with a PostgreSQL client or the deployment database console by confirming the `externalId` columns and unique constraints on both message tables, then run `pnpm check && pnpm lint && pnpm test && pnpm build`. The public `GET /health` endpoint is a process liveness check and does not claim database reachability. Authorized administrators can call the protected `admin.databaseHealth` tRPC procedure; it reports only `configured`, `dialect`, `reachable`, `persistenceMode`, and `migrationState`, never the connection string or credentials. `migrationState` remains `not-inspected` until a deployment-specific migration-table verification is implemented.

For a restart-persistence verification, run against the actual PostgreSQL target: create a test user, add a controlled Demo Credit entry, create a mock SMS activation, simulate its receipt, create a temporary demo inbox, simulate one email, stop and restart the application, then query the protected workspace procedures again. Verify the activation, message metadata, inbox, email record, and wallet ledger are present and owned by the original user. Repeat the read as a different user and confirm the resource is not accessible. Do not describe this check as passed unless it used a real PostgreSQL service across the restart.

The managed SQL console available during development identifies as TiDB/MySQL and rejects PostgreSQL migration syntax such as quoted PostgreSQL `ALTER TABLE` statements. It cannot be used to validate or apply this PostgreSQL migration. No database persistence claim is made for that endpoint. Use the actual PostgreSQL deployment target or the local PostgreSQL service from `docker-compose.yml`; when neither is available, the in-memory fallback is intentionally non-durable and is suitable only for development and tests.

## Admin user management

The Admin Users section is available only through the existing administrator route and the `admin` tRPC router. `admin.users` accepts a trimmed search string for user ID, name, or email, a zero-based page, and a page size capped at 50. Results are ordered by creation timestamp and ID, and the procedure returns only safe account fields: ID, name, email, role, status, creation time, and last sign-in time. Search and detail calls use the existing distributed rate limiter.

`admin.userDetail` accepts one positive user ID and returns bounded operational summaries for the account, wallet, SMS activations, demo mailboxes, recent wallet ledger metadata, and recent audit metadata. It never returns passwords, OAuth tokens, API keys, session secrets, database credentials, or private message bodies. When PostgreSQL is not available, user-management search returns an honest empty result and detail inspection explains that persistent user management requires PostgreSQL; it does not manufacture fallback users.

## Durable jobs and activity

SUBBY VIRTUAL uses a minimal PostgreSQL-backed dispatcher rather than a second queue framework. A job is created with a stable public reference, an owning user, one of four validated mock-workflow types, a small resource-ID payload, lifecycle timestamps, bounded retry state, progress, and redacted result/error metadata. The `jobs` table is claimed with a PostgreSQL transaction using `FOR UPDATE SKIP LOCKED`, so two workers cannot claim the same queued record concurrently.

| Job type                | Safe operation                                                          | User cancellation |
| ----------------------- | ----------------------------------------------------------------------- | ----------------- |
| `MOCK_SMS_DELIVERY`     | Complete an owned mock SMS activation and persist the simulated message | Before processing |
| `DEMO_EMAIL_SIMULATION` | Persist one simulated message in an owned active demo inbox             | Before processing |
| `MAILBOX_EXPIRY`        | Expire an owned temporary inbox                                         | Before processing |
| `ACTIVATION_EXPIRY`     | Expire an owned mock SMS activation                                     | Before processing |

The worker is request-driven and does not use an in-process timer. The cron-only endpoint `POST /api/scheduled/dispatch-jobs` authenticates the Manus scheduled-task identity and dispatches at most 25 jobs per invocation. In a deployed environment, create a project-level Heartbeat that calls this path at the desired cadence, for example `0 * * * * *` for once per minute. The existing `POST /api/scheduled/cleanup` endpoint remains responsible for legacy resource expiry. The site must be deployed before creating the Heartbeat; never schedule against a sandbox preview URL.

Each claimed job records `processing_started`, progress changes, and either `completed`, `retry_scheduled`, or `failed` through the existing `auditLogs` table. Transient errors may retry only while the attempt count is below the persisted maximum, with a bounded exponential delay capped at 30 seconds. Domain errors such as missing resources, invalid lifecycle state, expiry, cancellation, and insufficient balance fail permanently. A queued or retrying job can be cancelled only by its owner; processing, completed, failed, and already cancelled jobs cannot be changed through the user cancellation procedure.

The authenticated user procedures are `workspace.jobs.create`, `workspace.jobs.list`, `workspace.jobs.detail`, `workspace.jobs.activity`, and `workspace.jobs.cancel`. Inputs are validated, pages are bounded to 50 records, and all reads and cancellation operations are ownership-scoped. Admin procedures provide `admin.jobs.metrics`, `admin.jobs.list`, `admin.jobs.activity`, and `admin.jobs.dispatch`; admin job payloads, results, activity metadata, secrets, tokens, message bodies, and raw connection details are redacted.

In PostgreSQL mode, jobs and their lifecycle audit records are durable across server restarts. In development fallback mode, the job store is an explicitly bounded in-memory service and the UI states that history is non-durable. Production remains fail-closed when PostgreSQL is missing or unavailable. Apply the generated `drizzle/0006_smooth_dust.sql` migration to a real PostgreSQL target and verify the `jobs` table and both indexes before claiming restart persistence. The managed development endpoint previously available to this project identifies as TiDB/MySQL and is not valid evidence for this PostgreSQL migration.

## Phase 1 dispatcher hardening

SMS and email simulation requests are queue-authoritative: the tRPC mutation validates the owned active resource and returns a stable job reference, while only the scheduled dispatcher invokes the mock delivery lifecycle. Repeated requests for the same user and resource return the same job and do not create duplicate messages.

Before claiming new work, `POST /api/scheduled/dispatch-jobs` recovers stale `PROCESSING` rows. Jobs with retry budget remaining return to `RETRYING` with bounded backoff; exhausted jobs become `FAILED` with a safe timeout code. Lock metadata is cleared, recovery counters are recorded, and the transition is written to `auditLogs`. The fallback mode applies the same policy in memory for local tests only.

Startup exposes an explicit dispatcher readiness state through `/health`, and the server logs the scheduled dispatch path after startup. No in-process timer is used. Concurrent dispatch calls share an in-flight guard, and PostgreSQL claims continue to use `FOR UPDATE SKIP LOCKED`. Apply the additive `drizzle/0007_modern_eternals.sql` migration to the real PostgreSQL target before relying on durable recovery metadata; the configured TiDB/MySQL-compatible development endpoint is not a valid PostgreSQL migration target.

Both cron-only callbacks return generic JSON failures on unexpected server errors rather than relaying raw exception messages. This preserves the platform retry signal without exposing database, provider, or runtime details to callback consumers.
