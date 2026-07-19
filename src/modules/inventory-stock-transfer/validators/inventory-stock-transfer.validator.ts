import { z } from "zod"
import { STOCK_CONDITIONS } from "../../../core/enums"

export const InventoryStockTransferValidator = z.object({
    fromBranchId: z.number("Source branch is required"),
    toBranchId: z.number("Destination branch is required"),
    note: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional().nullable(),
    items: z.array(z.object({
        variantId: z.number("Variant ID is required"),
        condition: z.enum(STOCK_CONDITIONS),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
    })).min(1, "At least one item is required"),
})
export type InventoryStockTransferValidator = z.infer<typeof InventoryStockTransferValidator>
