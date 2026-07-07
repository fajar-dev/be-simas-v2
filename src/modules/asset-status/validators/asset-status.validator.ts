import { z } from "zod"

const VALID_STATUSES = ["active", "idle", "under_repair", "damaged", "lost", "sold", "disposed"] as const

export const CreateAssetStatusValidator = z.object({
    assetId: z.number("Asset ID is required"),
    status: z.enum(VALID_STATUSES, "Status is required"),
    note: z.string().trim().optional().nullable(),
    returnActiveHolders: z.boolean().optional(),
})

export type CreateAssetStatusValidator = z.infer<typeof CreateAssetStatusValidator>

export const BulkCreateAssetStatusValidator = z.object({
    assetIds: z.array(z.number().min(1, "Asset ID is required")),
    status: z.enum(VALID_STATUSES, "Status is required"),
    note: z.string().trim().optional().nullable(),
    returnActiveHolders: z.boolean().optional(),
})
export type BulkCreateAssetStatusValidator = z.infer<typeof BulkCreateAssetStatusValidator>
