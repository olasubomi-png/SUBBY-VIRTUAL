# Security

Authentication uses the scaffold's secure OAuth session cookie. All customer data procedures are protected, and the administrator overview uses an explicit role guard. Inputs are validated with Zod before reaching provider contracts, and database access uses Drizzle parameterization.

Wallet balances are derived from ledger entries rather than directly edited fields. Every ledger reference must be unique, entries are append-only at the domain layer, and debit operations must reject insufficient funds. Production implementations should enforce the same invariant inside a database transaction with appropriate row locking.

The application should retain rate limits for account creation and purchase requests, device/IP risk hooks, suspension controls, and structured audit logs. Phase 1 mock providers ensure no live delivery or payment action can occur accidentally.
