import { Context } from "hono"
import { MistWebhookService } from "./mist-webhook.service"
import { ApiResponse } from "../../core/helpers/response"

export class MistWebhookController {
    constructor(private readonly service: MistWebhookService) {}

    async handleWebhook(c: Context) {
        // Verify webhook secret
        const secret = c.req.header('X-Mist-Secret') || c.req.query('secret') || ''
        if (!this.service.verifySecret(secret)) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const body = await c.req.json()
        const topic = body.topic

        // Only handle zone events
        if (topic !== 'zone') {
            return ApiResponse.success(c, { message: `Topic '${topic}' ignored` })
        }

        const events = body.events || []
        const results = []

        for (const event of events) {
            try {
                const result = await this.service.handleZoneEvent(event)
                results.push({ mac: event.mac, ...result })
            } catch (err: any) {
                results.push({ mac: event.mac, status: 'error', message: err.message })
            }
        }

        return ApiResponse.success(c, { processed: results.length, results })
    }
}
