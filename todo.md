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

- [x] Synchronize the latest validated project state to GitHub main
- [x] Change SUBBY-VIRTUAL visibility to public as requested
- [x] Verify the public repository and pushed main commit

# Persistent message storage upgrade

- [x] Audit existing message, mailbox, activation, wallet, audit, and migration models without duplicating tables
- [x] Add or complete a PostgreSQL message persistence contract for email and SMS records
- [x] Add transactional/idempotent persistence helpers for simulated email and SMS completion
- [x] Wire persistent mailbox and activation detail/list procedures while preserving fallback boundaries
- [x] Preserve admin message-body redaction and ownership/RBAC protections
- [x] Add database-independent tests for persistence contracts, duplicate simulation, lifecycle failures, and fallback behavior
- [x] Generate and review an additive migration; apply only if the configured database is reachable
- [x] Update documentation for restart persistence, fallback behavior, migration procedure, and limitations
- [x] Run pnpm lint, pnpm check, pnpm test, and pnpm build
- [x] Save a final checkpoint and report exact files, migration, persistence architecture, tests, commands, and limitations

# Persistent message coverage follow-up

- [x] Add deterministic duplicate SMS/email simulation tests and verify no duplicate fallback messages
- [x] Add a persistence-contract test documenting PostgreSQL-only execution and safe unconfigured failure

# PostgreSQL production-readiness continuation

- [x] Add explicit server-side persistence-mode detection that distinguishes PostgreSQL, unavailable PostgreSQL, and development fallback without silently downgrading production
- [x] Add a protected admin database health/status procedure with safe reachability and migration metadata fields
- [x] Harden PostgreSQL connection initialization and error handling so credentials are never logged and availability is not overstated
- [x] Add database-independent tests for persistence-mode detection, health redaction, and safe database failure behavior
- [x] Update deployment documentation with the exact PostgreSQL migration, verification, and restart-persistence runbook
- [x] Run pnpm lint, pnpm check, pnpm test, and pnpm build after the readiness changes
- [x] Save a new checkpoint and synchronize the readiness update to GitHub

# Admin user management continuation

- [x] Add bounded server-side admin user search with deterministic pagination and safe empty results
- [x] Add protected admin user detail data with wallet, SMS, mail, and audit summaries
- [x] Preserve strict admin authorization, privacy redaction, and rate limiting for user management procedures
- [x] Add Admin Users search, pagination, and detail views to the existing admin interface
- [x] Add authorization, search, pagination, privacy, and persistent-database-path tests
- [x] Document admin user-management behavior, available fields, and redaction rules
- [x] Run pnpm lint, pnpm check, pnpm test, and pnpm build
- [x] Save a checkpoint and synchronize the completed admin user-management feature to GitHub

# Admin user-management evidence hardening

- [x] Add explicit safe audit-metadata serialization that removes sensitive fields from user detail responses
- [x] Add successful persistent search tests for ID/name/email, real multi-page pagination, and empty results
- [x] Add user-detail privacy and ownership tests proving open IDs, secrets, message bodies, and unrelated user data are omitted
- [x] Re-run validation, then save and synchronize the final admin user-management checkpoint

# Admin user-management evidence correction

- [x] Add a seeded multi-page persistent search test proving distinct bounded result sets and deterministic ordering across pages
- [x] Add a seeded cross-user detail isolation test proving user A cannot receive user B wallet, activation, mailbox, message, or audit data
- [x] Extend the detail privacy test across all response sections and keep the audit allowlist assertions

# Persistent job system and real-time activity continuation

- [x] Add a validated persistent PostgreSQL job model with stable reference, owner, type, status, progress, attempts, retry, lifecycle timestamps, payload metadata, result metadata, and safe error metadata
- [x] Add supported mock-workflow job types only; reject arbitrary commands, code, and unsupported payloads
- [x] Implement atomic durable job claiming and lifecycle transitions that prevent duplicate concurrent processing
- [x] Implement bounded transient retry policy, permanent failure handling, and cancellation-aware retry suppression
- [x] Integrate job lifecycle activity events with the existing audit system using safe metadata
- [x] Add authenticated user job list, detail, activity, and ownership-scoped cancellation procedures with bounded pagination
- [x] Add protected admin job metrics, recent activity, status filtering, and redacted job detail procedures
- [x] Add Jobs / Activity frontend views with server data, controlled refresh, progress, errors, and eligible cancellation
- [x] Preserve explicit PostgreSQL durability and non-durable fallback boundaries without enabling live providers or payments
- [x] Add comprehensive job lifecycle, retry, cancellation, duplicate-claim, ownership, privacy, admin, and fallback tests
- [x] Generate and review an additive PostgreSQL migration without claiming it was applied to the incompatible managed endpoint
- [x] Document job architecture, worker startup, supported types, retry/cancellation policy, activity, monitoring, and persistence modes
- [x] Run pnpm lint, pnpm check, pnpm test, and pnpm build
- [x] Save a final checkpoint, push the release to GitHub main, and report the exact SHA

# Persistent job evidence hardening

- [x] Add direct persistent-repository tests proving create, claim, progress, complete, retry/fail, and cancel lifecycle events are written to and read from auditLogs
- [x] Add fallback user/admin job detail and activity redaction tests for payload, result, error, lock metadata, message bodies, and secret-like keys
- [x] Add a persistent-path redaction test proving sanitized job payload/result/error/activity responses and no lock metadata

# Fallback job privacy evidence correction

- [x] Add fallback-mode user/admin list, detail, and activity tests covering payload/result/error sanitization, lock omission, secret-like key stripping, and message/body omission

# Persistent job release evidence closure

- [x] Save a new checkpoint for the validated persistent job-system release
- [x] Push the new release to GitHub main and verify origin/main matches
- [x] Record the exact pushed GitHub SHA in the release report and handoff
