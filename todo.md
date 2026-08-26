# Project TODO

- [x] Establish SUBBY VIRTUAL Phase 1 product vocabulary and scope boundaries
- [x] Implement normalized wallet, ledger, transaction, delivery request, provider, support, and audit data structures
- [x] Add secure wallet calculations that preserve immutable ledger integrity
- [x] Add protected customer procedures for dashboard metrics, wallet activity, and mock SMS/mail delivery requests
- [x] Add provider abstractions and deterministic mock SMS/mail status flows
- [x] Build the polished customer dashboard shell and protected routes
- [x] Build customer pages for dashboard, SMS, mail, wallet, transactions, settings, and support
- [x] Add protected administrator procedure and operations overview foundation
- [x] Build administrator operations views for users, wallet activity, delivery requests, providers, pricing, and audit logs
- [x] Add security-oriented validation, RBAC, abuse-control hooks, and audit logging foundations
- [x] Add Docker Compose services and safe environment reference
- [x] Add documentation: README, architecture, API, deployment, and security
- [x] Add and update Vitest coverage for wallet integrity, authentication, RBAC, provider abstractions, and API validation
- [x] Run dependency installation, lint/type checks, tests, and production build; fix all errors
- [x] Capture final UI verification screenshots and confirm responsive behavior
- [x] Commit completed Phase 1 to the private GitHub repository SUBBY-VIRTUAL

- [x] Complete deterministic mock provider lifecycle methods and status progression
- [x] Register protected customer routes for all Phase 1 pages and add a transactions view
- [x] Expand administrator operations into distinct review sections
- [x] Add abuse-control hooks, structured audit primitives, and environment reference
- [x] Add RBAC and API validation tests and run the lint command
- [x] Capture mobile and route-level UI verification screenshots

# Persistence and production-readiness upgrade

- [x] Audit and unify the database stack around PostgreSQL without rebuilding the project
- [x] Replace hard-coded wallet/demo ledger data with persistent minor-unit models and idempotent ledger operation foundations
- [x] Persist SMS activations and temporary inbox metadata across restarts; message persistence schema retained for next adapter pass
- [x] Replace in-memory audit events with database-backed audit records and pagination
- [x] Replace in-memory request throttling with Redis-backed customer request limits; admin endpoint policy foundation retained
- [x] Add provider registries, health checks, and secure configuration boundaries
- [x] Add ownership-aware realtime event foundation and idempotent background cleanup jobs
- [x] Replace demo admin metrics with authorized database-backed operational queries and pagination
- [x] Add cross-user authorization, persistence-foundation, Redis-fallback, provider, realtime, and expiry test coverage
- [x] Update VPS deployment documentation, health checks, graceful shutdown, and private service networking
- [x] Run pnpm check, pnpm lint, pnpm test, and pnpm build with all failures fixed
- [ ] Commit the upgrade to the existing private SUBBY-VIRTUAL repository and report the commit hash

# Upgrade hardening follow-up

- [x] Wire workspace summary and ledger reads to PostgreSQL wallet/ledger queries with no customer-facing demo balances
- [x] Make database audit reads the admin audit source in persistent mode with a non-persistent development fallback
- [x] Add Redis-backed customer rate limits with fail-closed configured behavior and document production Redis requirement
- [x] Add mock-only provider registry and health-state foundation with credentials kept server-side
- [x] Replace admin provider and inbox metrics with database-backed counts in persistent mode
- [x] Add persistence, cleanup, realtime ownership, RBAC, and request-limit foundation coverage

# Final validation follow-up

- [x] Implement provider configuration validation and evaluated health results
- [x] Wire admin overview to actual provider and inbox metrics without hard-coded counts
- [x] Add deterministic tests for persistence helper configuration boundaries and cleanup expiry behavior

# Evidence-quality follow-up

- [x] Add callable mock provider health evaluation with registry-state diagnostics
- [x] Add controlled database-mock tests for ledger and persistence configuration boundaries plus cleanup behavior
