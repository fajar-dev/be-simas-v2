import { Context, Next } from 'hono'

/**
 * Request Logger Middleware
 * 
 * Log setiap request yang masuk dengan format:
 * [TIMESTAMP] METHOD /path → STATUS (duration)
 * 
 * Contoh output:
 * [2026-06-17T15:00:00.000Z] GET /api/user → 200 (12ms)
 * [2026-06-17T15:00:01.000Z] POST /api/auth/login → 401 (156ms)
 */
export const requestLogger = async (c: Context, next: Next) => {
    const start = Date.now()
    const method = c.req.method
    const path = c.req.path

    await next()

    const duration = Date.now() - start
    const status = c.res.status
    const timestamp = new Date().toISOString()

    // Color-coded status for terminal readability
    const statusColor = status >= 500 ? '\x1b[31m'  // red
        : status >= 400 ? '\x1b[33m'                 // yellow
        : status >= 300 ? '\x1b[36m'                 // cyan
        : '\x1b[32m'                                  // green
    const reset = '\x1b[0m'

    console.log(`[${timestamp}] ${method} ${path} → ${statusColor}${status}${reset} (${duration}ms)`)
}
