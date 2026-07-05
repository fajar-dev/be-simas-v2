import { z } from "zod"

export const CreateAssetMaintenanceValidator = z.object({
    assetId: z.number({ required_error: "Asset ID is required" }),
    date: z.string().trim().min(1, "Date is required"),
    note: z.string().trim().min(1, 'Note is required'),
    cost: z.number().min(0, 'Cost must be >= 0').optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
})

export const UpdateAssetMaintenanceValidator = z.object({
    assetId: z.number().optional(),
    date: z.string().trim().optional(),
    note: z.string().trim().optional(),
    cost: z.number().min(0, 'Cost must be >= 0').optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
})

export type CreateAssetMaintenanceValidator = z.infer<typeof CreateAssetMaintenanceValidator>
export type UpdateAssetMaintenanceValidator = z.infer<typeof UpdateAssetMaintenanceValidator>
