-- Migration: Job queue (`jobs` + `failed_jobs`)
-- Backs the `queue` module — outbound integrations (currently: Nusawork
-- asset-holder sync) are pushed here and executed by a separate worker
-- process (`bun run queue:work`), not inline in the request path. Jobs that
-- exhaust their retries land in `failed_jobs` (inspect/retry via
-- GET/POST /api/queue/failed).
--
-- Verified against a TypeORM-synced dev database via the scratch-database
-- round-trip method used by every migration in this directory — only
-- cosmetic differences expected (hand-written index names here vs
-- TypeORM's auto-generated hashed names there).
--
-- HOW TO RUN
--   1. Back up production first — CREATE TABLE auto-commits per statement.
--   2. mysql -u <user> -p <database> < migrations/2026-09-14-queue.sql
--   3. Re-running fails loudly (tables already exist) rather than reapplying.
--   4. Start the worker as its own long-running process: bun run queue:work

CREATE TABLE `jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `job_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `reserved_at` datetime(6) DEFAULT NULL,
  `available_at` datetime(6) NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_jobs_queue` (`queue`),
  KEY `idx_jobs_available_at` (`available_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `failed_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `job_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `exception` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_failed_jobs_uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
