# Deployment

Use Node.js 22 or newer, pnpm, and Docker Compose. On an Ubuntu VPS, clone the private repository, install dependencies with `pnpm install`, start local infrastructure with `docker compose up -d`, verify with `pnpm check && pnpm test && pnpm build`, and run the compiled server with `pnpm start`. Configure a TLS reverse proxy and keep database and Redis ports private.

Secrets belong in the deployment secret manager. The Phase 1 runtime must not contain production SMS, email, or payment credentials because those integrations are deliberately deferred.
