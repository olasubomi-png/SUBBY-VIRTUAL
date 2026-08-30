-- ============================================================================
-- SUBBY-VIRTUAL: Points → NGN kobo wallet ledger migration
-- DO NOT RUN BLINDLY. Backup first. Inspect production data.
-- Application code (commit 9076bc7+) expects ledger amount_minor in NGN kobo.
-- ============================================================================

-- DIAGNOSTIC (read-only):
-- SELECT max("amountMinor") AS max_ledger FROM "walletLedgerEntries";
-- SELECT max("balanceMinor") AS max_wallet FROM "wallets";  -- if column exists
-- SELECT max("quotedPriceMinor") AS max_quoted FROM "smsActivations";
-- SELECT "type", count(*), min("amountMinor"), max("amountMinor")
--   FROM "walletLedgerEntries" GROUP BY "type";

-- INTERPRETATION:
-- If max ledger amounts are small (e.g. < 10000), rows are almost certainly
-- still in whole Points (1 Point = 1 unit). Convert with × 50000.
-- If max amounts are already large (e.g. >= 50000 and look like kobo),
-- DO NOT multiply again.

-- CONVERSION (only when diagnostics confirm Point units):
-- BEGIN;
-- UPDATE "walletLedgerEntries"
--   SET "amountMinor" = "amountMinor" * 50000
--   WHERE "amountMinor" > 0 AND "amountMinor" < 10000;
-- UPDATE "smsActivations"
--   SET "quotedPriceMinor" = "quotedPriceMinor" * 50000
--   WHERE "quotedPriceMinor" IS NOT NULL
--     AND "quotedPriceMinor" > 0
--     AND "quotedPriceMinor" < 10000;
-- -- Recompute wallet balances from ledger if a cached balance column exists.
-- COMMIT;

-- AFTER migration, verify:
-- A user who had 10 Points should show balanceMinor = 500000 (₦5,000).
-- New Paystack top-up of pts_2 must credit 100000 kobo.
-- SMS retail 30000 must leave balance decreased by exactly 30000.
