import { z } from "zod"

/** Stock opname: SET absolute new/used quantities per variant at one branch (physical count, not increment). */
export const InventoryStockOpnameValidator = z.object({
    inventoryId: z.number("Inventory ID is required"),
    branchId: z.number("Branch ID is required"),
    note: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional().nullable(),
    items: z.array(z.object({
        variantId: z.number("Variant ID is required"),
        new: z.number().int().min(0, "Quantity cannot be negative"),
        used: z.number().int().min(0, "Quantity cannot be negative"),
    })).min(1, "At least one item is required"),
})
export type InventoryStockOpnameValidator = z.infer<typeof InventoryStockOpnameValidator>
