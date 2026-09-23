import { Context } from "hono"
import { WebhookClientService } from "./webhook-client.service"
import { ApiResponse } from "../../core/helpers/response"
import { MistWebhookValidator, EsignWebhookValidator } from "./validators/webhook-client.validator"

export class WebhookClientController {
    constructor(private readonly service: WebhookClientService) {}

    async handleMist(c: Context) {
        const secret = c.req.header('X-Mist-Secret') || c.req.query('secret') || ''
        if (!this.service.verifyMistSecret(secret)) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const body = c.req.valid("json" as never) as MistWebhookValidator
        const topic = body.topic

        if (topic !== 'zone') {
            return ApiResponse.success(c, { message: `Topic '${topic}' ignored` })
        }

        const events = body.events || []
        const results = []

        for (const event of events) {
            try {
                const result = await this.service.handleMistZoneEvent(event)
                results.push({ mac: event.mac, ...result })
            } catch (err: any) {
                results.push({ mac: event.mac, status: 'error', message: err.message })
            }
        }

        return ApiResponse.success(c, { processed: results.length, results })
    }

    async handleEsign(c: Context) {
        const body = c.req.valid("json" as never) as EsignWebhookValidator
        try {
            const result = await this.service.handleEsignEvent(body)
            return ApiResponse.success(c, result, "Esign webhook handled successfully")
        } catch (err: any) {
            return ApiResponse.error(c, err.message, 400)
        }
    }
}
