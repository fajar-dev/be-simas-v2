/**
 * Structured NDJSON logger for Grafana Loki. Writes each entry to stdout plus daily-rotated
 * logs/app-*.log (all levels) and logs/error-*.log (errors only). Format never branches on
 * NODE_ENV — that only affects whether src/index.ts exposes error detail in the HTTP response.
 * File writes are synchronous so short-lived jobs don't lose lines on process.exit().
 */

import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { config } from "../../config/config"

export type LogLevel = "info" | "warn" | "error"

const SERVICE = "simas-be"
const LOG_DIR = join(process.cwd(), "logs")
// Off in tests only, so they don't litter the working tree.
const FILE_ENABLED = config.logging.toFile && config.app.env !== "test"
// Set by scheduled jobs via crontab to tag lines with the emitting task; absent for the web server.
const TASK = config.logging.jobName

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
