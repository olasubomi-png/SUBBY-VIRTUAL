-- Wallet ledger unit migration: Points → NGN kobo
-- 1 Point was 50_000 kobo. Existing balances stored as whole Points are scaled.
-- SAFE only when all balances are still in Point units (typical: balances < 1_000_000).
-- Review production data before applying.

-- Scale wallet ledger amounts that look like Point units
-- Application code now credits/debits kobo exclusively.

-- Manual ops checklist (do not auto-run against unknown state):
-- 1. SELECT max(amount_minor) FROM wallet_ledger_entries;
-- 2. If values are small (e.g. < 10000), they are likely Points → multiply by 50000
-- 3. UPDATE wallet_ledger_entries SET amount_minor = amount_minor * 50000 WHERE ...;
-- 4. Recompute wallet balances from ledger or scale stored balance columns similarly
-- 5. Scale sms_activations.quoted_price_minor if those rows stored Points

-- This file documents the migration; apply with care on production after backup.
