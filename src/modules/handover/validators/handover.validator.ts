import { z } from "zod"
import { HANDOVER_TRANSACTION_TYPES, HANDOVER_ITEM_KINDS, STOCK_CONDITIONS } from "../../../core/enums"

const TransactionTypeEnum = z.enum(HANDOVER_TRANSACTION_TYPES)
const ItemKindEnum = z.enum(HANDOVER_ITEM_KINDS)

const HandoverItemValidator = z.object({
    assetId: z.number("Asset ID is required"),
    note: z.string().trim().optional().nullable(),
})

const HandoverStockItemValidator = z.object({
    variantId: z.number("Variant ID is required"),
    branchId: z.number("Branch ID is required"),
    condition: z.enum(STOCK_CONDITIONS),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    note: z.string().trim().optional().nullable(),
})

export const CreateHandoverValidator = z.object({
    receivedById: z.number("Received by ID is required"),
    handedOverById: z.number("Handed over by ID is required"),
    transactionType: TransactionTypeEnum,
    // Whether this handover carries assets (default) or stock.
    itemKind: ItemKindEnum.optional().default("asset"),
    note: z.string().trim().optional().nullable(),
    // Values for the configured custom fields, keyed by field key.
    customFields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
    // Asset lines (required when itemKind is "asset").
    items: z.array(HandoverItemValidator).optional(),
    // Stock lines (required when itemKind is "stock").
    stockItems: z.array(HandoverStockItemValidator).optional(),
}).superRefine((data, ctx) => {
    if (data.itemKind === "stock") {
        if (!data.stockItems || data.stockItems.length === 0) {
            ctx.addIssue({ code: "custom", path: ["stockItems"], message: "At least one stock item is required" })
        }
    } else if (!data.items || data.items.length === 0) {
        ctx.addIssue({ code: "custom", path: ["items"], message: "At least one item is required" })
    }
})

export type CreateHandoverValidator = z.infer<typeof CreateHandoverValidator>
