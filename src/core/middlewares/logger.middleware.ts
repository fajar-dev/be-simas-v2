import { Context, Next } from 'hono'
import { logger } from '../helpers/logger'

/**
 * Request Logger Middleware
 *
 * Emits one structured JSON line per request (NDJSON) for Grafana Loki / Promtail.
 * Log level is derived from the response status (5xx=error, 4xx=warn, else info).
 *
 * Example output:
 *   {"time":"2026-06-17T15:00:00.000Z","level":"info","service":"simas-be",
 *    "msg":"GET /api/user 200","method":"GET","path":"/api/user",
 *    "status":200,"duration_ms":12}
 */
export const requestLogger = async (c: Context, next: Next) => {
    const start = Date.now()

    await next()

    const status = c.res.status
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

    logger[level](`${c.req.method} ${c.req.path} ${status}`, {
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: Date.now() - start,
    })
}
