-- Migration: `transfers` — intake staging for the `transfer` module.
-- External systems POST items here via API key (name, price, quantity,
-- optional serial number(s)/code, purchase date, free-text created_by) as a
-- SINGLE row — `code` (JSON array, may be fewer than `quantity` or empty) and
-- `quantity` are expanded into that many actual Assets only at merge time,
-- via the normal Asset create form (pre-filled from this row, one code entry
-- per unit). `created_by` has no FK to `users` since intake has no
-- authenticated user — it's just whatever identifier the sender provides.
-- `merged_asset_ids` (JSON array) and `status` record the resulting Asset(s)
-- once merged — no FK/join table, this is lightweight staging, not a core
-- relation.
--
-- Verified against a TypeORM-synced dev database via the scratch-database
-- round-trip method used by every migration in this directory.
--
-- HOW TO RUN
--   1. Back up production first — CREATE TABLE auto-commits.
--   2. mysql -u <user> -p <database> < migrations/2026-09-22-transfer.sql
--   3. Re-running fails loudly (table already exists) rather than reapplying.

CREATE TABLE `transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` int DEFAULT NULL,
  `code` text COLLATE utf8mb4_unicode_ci,
  `quantity` int NOT NULL DEFAULT '1',
  `purchase_date` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `merged_asset_ids` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `created_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_transfers_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
