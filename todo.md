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
- [x] Commit the upgrade to the existing private SUBBY-VIRTUAL repository and report the commit hash

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

# Step 2 end-to-end demo upgrade

- [x] Audit the current repository, scripts, runtime, tests, database, and existing user flows
- [x] Generate and review the persistent Step 2 PostgreSQL migration and document the managed database TLS blocker and safe apply path
- [x] Build server-authoritative demo-credit and wallet transaction procedures with idempotency and negative-balance protection in the demo fallback path
- [x] Connect working mock SMS activation creation, simulated receipt, completion, ownership checks, and server-side ledger debit; persistent lifecycle write remains gated by database availability
- [x] Connect working temporary mailbox creation, address display/copy-ready UI, simulated email receipt, refresh query, expiry metadata, and ownership checks; persistent lifecycle write remains gated by database availability
- [x] Replace hard-coded wallet, activation, mailbox, and overview dashboard data with authenticated tRPC queries and mutations
- [x] Complete protected admin activation, mailbox, wallet-ledger, audit, and live overview review procedures; full user search UI remains a follow-on enhancement
- [x] Add meaningful cross-user authorization, wallet, SMS lifecycle, mail lifecycle, admin, and end-to-end UI-flow contract tests
- [x] Generate and review the migration, document the managed migration boundary, and run pnpm check, pnpm lint, pnpm test, and pnpm build
- [x] Commit Step 2 to the existing private SUBBY-VIRTUAL repository and report changed files, tests, build, and limitations

# Step 2 final gap fixes

- [x] Fix demo-credit idempotency so legitimate repeat top-ups are allowed while replayed requests remain safe
- [x] Add copy, refresh, and expiry display controls to the temporary mailbox UI
- [x] Remove remaining hard-coded overview and transaction data and use authenticated tRPC state everywhere
- [x] Make non-persistent overview balance reflect the live demo wallet
- [x] Document the managed PostgreSQL migration/TLS blocker and exact safe apply path
- [x] Add protected admin detail queries for wallet ledger, activations, mailboxes, and audit records

# Final summary fallback correction

- [x] Return the live demo wallet balance from workspace.summary when PostgreSQL is unavailable
- [x] Add a regression test proving summary balance follows demo credits in fallback mode

# Step 2 release evidence

- [x] Verify the Step 2 files exist on origin/main with a concrete commit hash
- [x] Prepare and save the Step 2 release report with changed files, validation results, and limitations

# Phase 1 continuation from implementation brief

- [x] Audit authentication, database, routers, providers, wallet, admin, frontend, error handling, authorization, and tests against the attached brief
- [x] Verify safe server-side wallet/ledger behavior and document the managed PostgreSQL persistence boundary
- [x] Verify mock SMS lifecycle including cancellation, invalid transitions, completion, and safe wallet activity
- [x] Verify demo mail lifecycle including metadata, refresh, expiry, expiration, and ownership isolation
- [x] Verify protected server-side admin aggregate metrics, detail procedures, and operational event visibility without exposing secrets or message content
- [x] Verify frontend loading, empty, success, error, request-detail, copy, refresh, and lifecycle states against actual backend state
- [x] Add missing authentication, wallet, SMS, mail, admin, security, invalid-transition, ownership, and input-validation tests
- [x] Run pnpm check, pnpm test, pnpm build, and the project lint command; fix failures
- [x] Save a final checkpoint and report files changed, features, schema, API, frontend, tests, commands, results, and remaining Phase 1 work

# Lifecycle transition coverage

- [x] Add tests for SMS cancellation and invalid post-completion transitions
- [x] Add tests for mailbox expiry and rejected post-expiry simulation

# Final Phase 1 evidence fixes

- [x] Redact admin inbox procedures to safe metadata and counts without exposing message bodies by default
- [x] Add explicit frontend loading, success, and error states plus a dedicated server-backed request-detail view
- [x] Add unauthenticated protected-procedure rejection and invalid SMS/mail/admin input tests

# Final evidence corrections

- [x] Add a dedicated request-detail surface with explicit success feedback for create, cancel, simulate, and expire actions
- [x] Add invalid admin procedure input coverage for audit pagination

# Final action feedback correction

- [x] Make create, cancel, simulate, and expire success messages action-specific and rerun validation

# GitHub visibility and main-branch release

- [ ] Synchronize the latest validated project state to GitHub main
- [ ] Change SUBBY-VIRTUAL visibility to public as requested
- [ ] Verify the public repository and pushed main commit
