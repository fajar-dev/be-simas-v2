import { z } from "zod"

const TransactionTypeEnum = z.enum(["serah_terima", "peminjaman", "pengembalian"])

const categoryEnum = z.enum(["inventaris_kantor", "aset_program_cicilan"])

const HandoverItemValidator = z.object({
    assetId: z.number("Asset ID is required"),
    note: z.string().trim().optional().nullable(),
})

export const CreateAssetHandoverValidator = z.object({
    receivedById: z.number("Received by ID is required"),
    handedOverById: z.number("Handed over by ID is required"),
    transactionType: TransactionTypeEnum,
    category: categoryEnum,
    purpose: z.string().trim().optional().nullable(),
    estimatedReturnDate: z.string().trim().optional().nullable(),
    items: z.array(HandoverItemValidator).min(1, "At least one item is required"),
})

export type CreateAssetHandoverValidator = z.infer<typeof CreateAssetHandoverValidator>
