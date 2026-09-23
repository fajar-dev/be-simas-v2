import { z } from "zod"

export const MistWebhookValidator = z.object({
    topic: z.string().optional(),
    events: z.array(z.object({
        site_id: z.string(),
        zone_id: z.string(),
        mac: z.string(),
        type: z.string(),
        timestamp: z.number(),
        name: z.string().optional(),
    })).optional(),
}).passthrough()

export type MistWebhookValidator = z.infer<typeof MistWebhookValidator>

export const EsignWebhookValidator = z.object({
    external_reference_id: z.union([z.string(), z.number()]),
    status: z.string(),
    file_url: z.string().optional(),
}).passthrough()

export type EsignWebhookValidator = z.infer<typeof EsignWebhookValidator>
