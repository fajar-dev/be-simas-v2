import { z } from "zod"
import { HANDOVER_TRANSACTION_TYPES } from "../../../core/enums"

const TransactionTypeEnum = z.enum(HANDOVER_TRANSACTION_TYPES)

const HandoverItemValidator = z.object({
    assetId: z.number("Asset ID is required"),
    note: z.string().trim().optional().nullable(),
})

export const CreateHandoverValidator = z.object({
    receivedById: z.number("Received by ID is required"),
    handedOverById: z.number("Handed over by ID is required"),
    transactionType: TransactionTypeEnum,
    note: z.string().trim().optional().nullable(),
    items: z.array(HandoverItemValidator).min(1, "At least one item is required"),
})

export type CreateHandoverValidator = z.infer<typeof CreateHandoverValidator>
