import { z } from "zod"

export const CreateAssetLocationValidator = z.object({
    assetId: z.number({ required_error: "Asset ID is required" }),
    locationId: z.number({ required_error: "Location ID is required" }),
    date: z.string().min(1, "Date is required"),
    note: z.string().optional().nullable(),
})

export type CreateAssetLocationValidator = z.infer<typeof CreateAssetLocationValidator>
