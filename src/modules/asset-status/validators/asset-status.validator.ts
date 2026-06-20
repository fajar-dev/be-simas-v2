import { z } from "zod"

const VALID_STATUSES = ["active", "idle", "under_repair", "damaged", "lost", "sold", "disposed"] as const

export const CreateAssetStatusValidator = z.object({
    assetId: z.number({ required_error: "Asset ID is required" }),
    status: z.enum(VALID_STATUSES, { required_error: "Status is required" }),
    note: z.string().optional().nullable(),
    date: z.string().min(1, "Date is required"),
})

export type CreateAssetStatusValidator = z.infer<typeof CreateAssetStatusValidator>
