import { z } from "zod"

export const CreateAssetLocationValidator = z.object({
    assetId: z.number({ required_error: "Asset ID is required" }),
    locationId: z.number({ required_error: "Location ID is required" }),
    date: z.string().trim().min(1, "Date is required"),
    note: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
})

export type CreateAssetLocationValidator = z.infer<typeof CreateAssetLocationValidator>
