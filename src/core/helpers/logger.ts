import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

const LOG_DIR = join(process.cwd(), "logs")
const LOG_FILE = join(LOG_DIR, "error.log")

function ensureLogDir() {
    if (!existsSync(LOG_DIR)) {
        mkdirSync(LOG_DIR, { recursive: true })
    }
}

export function logError(err: Error, context?: { method?: string; path?: string }) {
    ensureLogDir()

    const timestamp = new Date().toISOString()
    const method = context?.method || "-"
    const path = context?.path || "-"

    const logEntry = [
        `[${timestamp}]`,
        `${method} ${path}`,
        `Message: ${err.message}`,
        `Stack: ${err.stack || "N/A"}`,
        "---",
        "",
    ].join("\n")

    appendFileSync(LOG_FILE, logEntry)
}
