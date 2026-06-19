import { z } from "zod"

export const CreateAssetMaintenanceValidator = z.object({
    assetId: z.number({ required_error: "Asset ID is required" }),
    date: z.string().min(1, "Date is required"),
    note: z.string().optional(),
    attachmentIds: z.array(z.number()).optional(),
})

export const UpdateAssetMaintenanceValidator = z.object({
    assetId: z.number().optional(),
    date: z.string().optional(),
    note: z.string().optional(),
    attachmentIds: z.array(z.number()).optional(),
})

export type CreateAssetMaintenanceValidator = z.infer<typeof CreateAssetMaintenanceValidator>
export type UpdateAssetMaintenanceValidator = z.infer<typeof UpdateAssetMaintenanceValidator>
