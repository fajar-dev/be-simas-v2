import { z } from "zod"

export const BorrowBookValidator = z.object({
    assetId: z.number("Asset ID is required"),
    assignNote: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
})

export const ReturnBookValidator = z.object({
    assetHolderId: z.number("Asset holder ID is required"),
    returnNote: z.string().trim().url("Must be a valid URL"),
    attachmentIds: z.array(z.number()).optional(),
})