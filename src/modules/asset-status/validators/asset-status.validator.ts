import { z } from "zod"
import { ASSET_STATUSES } from "../../../core/enums"

export const CreateAssetStatusValidator = z.object({
    assetId: z.number("Asset ID is required"),
    status: z.enum(ASSET_STATUSES, "Status is required"),
    note: z.string().trim().optional().nullable(),
    returnActiveHolders: z.boolean().optional(),
})

export type CreateAssetStatusValidator = z.infer<typeof CreateAssetStatusValidator>

export const BulkCreateAssetStatusValidator = z.object({
    assetIds: z.array(z.number().min(1, "Asset ID is required")),
    status: z.enum(ASSET_STATUSES, "Status is required"),
    note: z.string().trim().optional().nullable(),
    returnActiveHolders: z.boolean().optional(),
})
export type BulkCreateAssetStatusValidator = z.infer<typeof BulkCreateAssetStatusValidator>
