# Deployment

Use Node.js 22 or newer, pnpm, and Docker Compose. On an Ubuntu VPS, clone the private repository, install dependencies with `pnpm install`, start private infrastructure with `docker compose up -d`, generate/apply PostgreSQL migrations with `DATABASE_URL=postgresql://... pnpm drizzle-kit migrate`, verify with `pnpm check && pnpm lint && pnpm test && pnpm build`, and run the compiled server with `pnpm start`. The health endpoint is `GET /health`; the Node process closes its database pool, Redis client, and HTTP server on SIGTERM/SIGINT.

Set `DATABASE_URL` to the PostgreSQL connection string and `REDIS_URL` to the private Redis connection string. PostgreSQL and Redis should remain on the internal Docker network or localhost; do not publish their ports to the public internet. Configure a TLS reverse proxy in front of the Node process.

For recurring cleanup, deploy first, then register the platform-managed callback: `manus-heartbeat create --name subby-cleanup --cron "0 */5 * * * *" --path /api/scheduled/cleanup --description "Expire demo inboxes and stale mock activations"`. The callback is cron-only and idempotent; it does not run from an in-process timer.

Secrets belong in the deployment secret manager. The runtime must not contain production SMS, email, or payment credentials because those integrations are deliberately deferred.

## Step 2 migration boundary

The Step 2 schema is defined in `drizzle/schema.ts`, and Drizzle generates PostgreSQL migrations under `drizzle/`. Generate and review migrations with `DATABASE_URL=... pnpm drizzle-kit generate` before applying them. The managed sandbox database rejected the attempted migration with an SSL/TLS connection error, so no claim is made that the incremental lifecycle columns are applied to the managed instance. Apply the reviewed SQL from a network location that can reach the PostgreSQL service, using the provider's required TLS settings, then verify the columns and Drizzle migration journal before enabling persistent lifecycle reads and writes.

For local development, use the PostgreSQL service from `docker-compose.yml` and run `DATABASE_URL=postgresql://subby:subby_dev_password@localhost:5432/subby pnpm drizzle-kit migrate`. Do not disable TLS against a remote production database; only local loopback connections use the non-TLS path in the application pool.
