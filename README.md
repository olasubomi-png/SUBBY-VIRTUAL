# SUBBY VIRTUAL

SUBBY VIRTUAL is a compliant communications testing workspace for managing mock SMS activations, temporary demo mail inboxes, and auditable wallet activity. Phase 1 intentionally does not contact production SMS or email providers and does not process real-money purchases.

## Stack

The supplied WebDev foundation provides React, Vite, Tailwind CSS, Express, tRPC, Manus OAuth, Drizzle ORM, and a managed database connection. Domain contracts are implemented in TypeScript and the current UI is mobile-first with a dark operational command-center visual system.

## Commands

```bash
pnpm install
docker compose up -d
pnpm dev
pnpm test
pnpm build
```

The preview is available at the URL printed by the development server. Authentication uses the scaffold's secure Manus OAuth session flow. In a production deployment, configure the supplied environment variables through the hosting platform's secret manager; never commit `.env` files or provider credentials.

## Phase 1 capabilities

Customers can review an available NGN balance, inspect immutable-style ledger activity, create mock SMS requests, create mock temporary mail inboxes, and review safe request statuses. Administrators have a protected tRPC overview procedure for operational metrics. The provider interfaces are defined in `server/domain.ts` and implemented by `MockSMSProvider` and `LocalDemoMailProvider`.

## Ubuntu VPS foundation

For a VPS, install Node.js 22+, pnpm, Docker, and Docker Compose. Clone the private repository, copy the environment templates into a secret-managed runtime environment, start PostgreSQL/Redis with `docker compose up -d`, run `pnpm install`, verify with `pnpm check`, `pnpm test`, and `pnpm build`, then run `pnpm dev` for development or `pnpm start` after the production build. Put a TLS reverse proxy in front of the Node process and restrict database/Redis ports to the private network.

## Phase 2 deferred

Production SMS and email receiving infrastructure, payment gateways, real-money purchasing, persistent private mailboxes, live WebSocket delivery events, and a full multi-package monorepo split are intentionally deferred until compliant provider contracts, operational policies, and production secrets are approved.
