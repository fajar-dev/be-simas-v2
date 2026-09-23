import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { AppDataSource } from './config/database'
import { serveStatic } from 'hono/bun'
import { swaggerUI } from '@hono/swagger-ui'
import api from './routes/api'
import { ApiResponse } from './core/helpers/response'
import { BaseException, ValidationException } from './core/exceptions/base'
import { ZodError } from 'zod'
import { config } from './config/config'
import { logError, logger } from './core/helpers/logger'
import { requestLogger } from './core/middlewares/logger.middleware'

const app = new Hono()

app.use('*', requestLogger)

app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

AppDataSource.initialize()
    .then(() => logger.info("Database connected", { event: "startup.db" }))
    .catch((err) => logger.error("Database connection failed", { event: "startup.db", error: err?.message, stack: err?.stack }))

app.get('/health', async (c) => {
    const dbConnected = AppDataSource.isInitialized
    const status = dbConnected ? 'healthy' : 'degraded'
    const statusCode = dbConnected ? 200 : 503

    return c.json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.app.env,
        checks: {
            database: dbConnected ? 'connected' : 'disconnected',
        }
    }, statusCode)
})

app.route('/api', api)

app.get('/api/swagger.yaml', serveStatic({ path: './swagger.yaml' }))
app.get('/api/docs', swaggerUI({ url: '/api/swagger.yaml' }))

app.get('/api/uploads/*', (c, next) => {
    return serveStatic({ 
        root: './public', 
        path: c.req.path.replace(/^\/api/, '') 
    })(c, next)
})

app.onError((err, c) => {
    if (err instanceof ZodError) {
        const valErr = new ValidationException(err)
        return ApiResponse.error(c, valErr.message, valErr.status, valErr.context)
    }

    if (err instanceof BaseException) {
        return ApiResponse.error(c, err.message, err.status, err.context)
    }

    // Always logged in full regardless of env; NODE_ENV only controls response exposure below.
    logError(err, { method: c.req.method, path: c.req.path })

    const errors = config.app.isProduction ? null : {
        message: err.message,
        stack: err.stack,
    }

    return ApiResponse.error(c, "Internal Server Error", 500, errors)
})

export default {
  port: config.app.port,
  fetch: app.fetch,
};
