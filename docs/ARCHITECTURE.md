# Architecture

The Phase 1 application uses the supplied React/Vite client and Express/tRPC server. Authentication is delegated to the scaffold's Manus OAuth session middleware; protected procedures receive `ctx.user`, while admin procedures enforce the `admin` role.

The wallet model separates wallets from immutable ledger entries. A balance is derived as credits minus debits, and request mutations must be wrapped in a database transaction in production. SMS and mail flows depend on provider contracts so mock implementations can be replaced after compliance and operational review.

The current deployment is a single Node process with managed database access. PostgreSQL and Redis are supplied as local Docker development services for the planned production-oriented architecture; the scaffold's managed database remains the active runtime connection in this Phase 1 build.
