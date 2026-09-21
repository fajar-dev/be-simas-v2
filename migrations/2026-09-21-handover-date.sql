-- Migration: `handovers.date` — the date/time of the handover itself, set by
-- the requester when creating it (frontend defaults it to "now", editable).
-- Used as the resulting AssetHolder's assignedDate/returnedDate once
-- approved, instead of hardcoding the approval timestamp. Nullable so
-- existing rows stay valid; the service falls back to the approval time for
-- any handover created before this column existed.
--
-- Verified against a TypeORM-synced dev database via the scratch-database
-- round-trip method used by every migration in this directory.
--
-- HOW TO RUN
--   1. Back up production first — ALTER TABLE auto-commits.
--   2. mysql -u <user> -p <database> < migrations/2026-09-21-handover-date.sql
--   3. Re-running fails loudly (column already exists) rather than reapplying.

ALTER TABLE `handovers`
  ADD COLUMN `date` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `updated_at`;
