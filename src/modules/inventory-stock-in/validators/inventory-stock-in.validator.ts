import { z } from "zod"

/** Stock-in: ADD quantities to variants across one or more branches (increments, not opname). */
export const InventoryStockInValidator = z.object({
    inventoryId: z.number("Inventory ID is required"),
    note: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional().nullable(),
    items: z.array(z.object({
        branchId: z.number("Branch ID is required"),
        variantId: z.number("Variant ID is required"),
        new: z.number().int().min(0, "Quantity cannot be negative"),
        used: z.number().int().min(0, "Quantity cannot be negative"),
    })).min(1, "At least one item is required"),
})
export type InventoryStockInValidator = z.infer<typeof InventoryStockInValidator>
