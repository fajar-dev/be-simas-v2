import { z } from "zod"

export const CreateAssetNoteValidator = z.object({
    assetId: z.number({ required_error: "Asset ID is required" }),
    date: z.string().trim().min(1, "Date is required"),
    note: z.string().trim().min(1, 'Note is required'),
    attachmentIds: z.array(z.number()).optional(),
    labels: z.array(z.object({
        key: z.string().trim().min(1),
        value: z.string().trim().min(1),
    })).optional(),
})

export const UpdateAssetNoteValidator = z.object({
    assetId: z.number().optional(),
    date: z.string().trim().optional(),
    note: z.string().trim().optional(),
    attachmentIds: z.array(z.number()).optional(),
    labels: z.array(z.object({
        key: z.string().trim().min(1),
        value: z.string().trim().min(1),
    })).optional(),
})

export type CreateAssetNoteValidator = z.infer<typeof CreateAssetNoteValidator>
export type UpdateAssetNoteValidator = z.infer<typeof UpdateAssetNoteValidator>
