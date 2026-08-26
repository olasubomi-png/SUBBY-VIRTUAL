# Deployment

Use Node.js 22 or newer, pnpm, and Docker Compose. On an Ubuntu VPS, clone the private repository, install dependencies with `pnpm install`, start private infrastructure with `docker compose up -d`, generate/apply PostgreSQL migrations with `DATABASE_URL=postgresql://... pnpm drizzle-kit migrate`, verify with `pnpm check && pnpm lint && pnpm test && pnpm build`, and run the compiled server with `pnpm start`. The health endpoint is `GET /health`; the Node process closes its database pool, Redis client, and HTTP server on SIGTERM/SIGINT.

Set `DATABASE_URL` to the PostgreSQL connection string and `REDIS_URL` to the private Redis connection string. PostgreSQL and Redis should remain on the internal Docker network or localhost; do not publish their ports to the public internet. Configure a TLS reverse proxy in front of the Node process.

For recurring cleanup, deploy first, then register the platform-managed callback: `manus-heartbeat create --name subby-cleanup --cron "0 */5 * * * *" --path /api/scheduled/cleanup --description "Expire demo inboxes and stale mock activations"`. The callback is cron-only and idempotent; it does not run from an in-process timer.

Secrets belong in the deployment secret manager. The runtime must not contain production SMS, email, or payment credentials because those integrations are deliberately deferred.
