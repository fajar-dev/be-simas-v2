import { z } from "zod"

// Intake via API key, no auth user — always one row; the Asset create form expands it into Assets at merge time.
export const CreateTransferValidator = z.object({
    name: z.string().trim().min(1, "Name is required"),
    price: z.number().int().optional().nullable(),
    quantity: z.number().int().positive("Quantity must be a positive integer").optional().default(1),
    code: z.array(z.string().trim().min(1)).optional().default([]),
    purchaseDate: z.string().trim().optional().nullable(),
    createdBy: z.string().trim().min(1).optional().nullable(),
})
export type CreateTransferValidator = z.infer<typeof CreateTransferValidator>

// Links a row to the Asset(s) already created from it (pre-filled Asset form) — see TransferService.merge().
export const MergeTransferValidator = z.object({
    assetIds: z.array(z.number().int().positive()).min(1, "At least one asset ID is required"),
})
export type MergeTransferValidator = z.infer<typeof MergeTransferValidator>
