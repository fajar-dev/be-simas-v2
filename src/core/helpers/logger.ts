/**
 * Structured JSON logger for Grafana Loki / Promtail.
 *
 * Every entry is a single-line JSON object (NDJSON) written to these sinks:
 *   1. stdout — captured by Docker / PM2 and shipped to Loki by Promtail.
 *   2. logs/app-YYYY-MM-DD.log   — daily-rotated history of ALL levels.
 *   3. logs/error-YYYY-MM-DD.log — daily-rotated history of ERROR levels only,
 *      so failures are easy to isolate without scanning the full stream.
 *
 * The format is identical in every environment — nothing here branches on
 * production vs development. `NODE_ENV` is NOT recorded and does not change how
 * or what we log; its ONLY effect (in src/index.ts) is whether an unhandled 500
 * exposes its detail in the HTTP response. Errors are always written to file.
 *
 * Scheduled jobs set JOB_NAME (via crontab) so every line is tagged with the
 * task that produced it, e.g. JOB_NAME=sync-employee → {"task":"sync-employee"}.
 *
 * File sinks use synchronous appends so no line is lost when short-lived jobs
 * call process.exit(). Disable them with LOG_TO_FILE=false (stdout stays on).
 */

import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

export type LogLevel = "info" | "warn" | "error"

const SERVICE = "simas-be"
const LOG_DIR = join(process.cwd(), "logs")
// File sinks are an operational toggle, not an environment switch. They stay on
// everywhere except automated tests (which should not litter the working tree).
const FILE_ENABLED = process.env.LOG_TO_FILE !== "false" && process.env.NODE_ENV !== "test"
// Set by scheduled jobs (via crontab) to tag every line with which task emitted
// it, e.g. JOB_NAME=sync-employee. Absent for the web server.
const TASK = process.env.JOB_NAME || undefined

let dirReady = false
function ensureDir(): boolean {
    if (dirReady) return true
    try {
        if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
        dirReady = true
    } catch {
        return false
    }
    return true
}

function appendDaily(prefix: string, date: string, line: string): void {
    try {
        appendFileSync(join(LOG_DIR, `${prefix}-${date}.log`), line)
    } catch {
        // ignore file write errors — stdout already carries the log
    }
}

function emit(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
    const time = new Date().toISOString()
    const entry: Record<string, unknown> = {
        time,
        level,
        service: SERVICE,
        ...(TASK ? { task: TASK } : {}),
        msg: message,
        ...fields,
    }
    // Single physical line — JSON.stringify escapes any newlines (e.g. in stacks).
    const line = JSON.stringify(entry) + "\n"

    // Primary sink: stdout (Docker/PM2 → Promtail → Loki)
    process.stdout.write(line)

    // File sinks: daily-rotated on-disk history (never let them break the app).
    if (FILE_ENABLED && ensureDir()) {
        const date = time.slice(0, 10)
        appendDaily("app", date, line)
        // Errors get an extra dedicated file so they can be read in isolation.
        if (level === "error") appendDaily("error", date, line)
    }
}

export const logger = {
    info: (message: string, fields?: Record<string, unknown>) => emit("info", message, fields),
    warn: (message: string, fields?: Record<string, unknown>) => emit("warn", message, fields),
    error: (message: string, fields?: Record<string, unknown>) => emit("error", message, fields),
}

/**
 * Backward-compatible error logger. Emits one structured JSON line (with the
 * stack kept as an escaped field so it stays on a single Loki log line) to both
 * the app log and the dedicated error log.
 */
export function logError(err: Error, context?: { method?: string; path?: string }): void {
    logger.error(err.message, {
        method: context?.method ?? "-",
        path: context?.path ?? "-",
        error: err.name,
        stack: err.stack,
    })
}
