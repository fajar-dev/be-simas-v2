import { z } from "zod"

/** Nested stock input: set absolute new/used quantities per variant for a branch. */
export const InventoryStockEntryValidator = z.object({
    branchId: z.number("Branch ID is required"),
    inventoryId: z.number("Inventory ID is required"),
    items: z.array(z.object({
        variantId: z.number("Variant ID is required"),
        new: z.number().int().min(0, "Quantity cannot be negative"),
        used: z.number().int().min(0, "Quantity cannot be negative"),
    })).min(1, "At least one item is required"),
})
export type InventoryStockEntryValidator = z.infer<typeof InventoryStockEntryValidator>
