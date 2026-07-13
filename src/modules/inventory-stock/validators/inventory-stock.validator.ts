import { z } from "zod"
import { STOCK_CONDITIONS } from "../../../core/enums"

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

export const InventoryStockTransferValidator = z.object({
    fromBranchId: z.number("Source branch is required"),
    toBranchId: z.number("Destination branch is required"),
    note: z.string().trim().optional().nullable(),
    items: z.array(z.object({
        variantId: z.number("Variant ID is required"),
        condition: z.enum(STOCK_CONDITIONS),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
    })).min(1, "At least one item is required"),
})
export type InventoryStockTransferValidator = z.infer<typeof InventoryStockTransferValidator>

/** Assign stock from a branch to an employee (creates a holding, reduces branch stock). */
export const InventoryStockAssignValidator = z.object({
    employeeId: z.number("Employee ID is required"),
    note: z.string().trim().optional().nullable(),
    items: z.array(z.object({
        variantId: z.number("Variant ID is required"),
        branchId: z.number("Branch ID is required"),
        condition: z.enum(STOCK_CONDITIONS),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
    })).min(1, "At least one item is required"),
})
export type InventoryStockAssignValidator = z.infer<typeof InventoryStockAssignValidator>

/** Return stock an employee holds; it always comes back into `used` stock at the given branch. */
export const InventoryStockReturnValidator = z.object({
    employeeId: z.number("Employee ID is required"),
    note: z.string().trim().optional().nullable(),
    items: z.array(z.object({
        variantId: z.number("Variant ID is required"),
        branchId: z.number("Branch ID is required"),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
    })).min(1, "At least one item is required"),
})
export type InventoryStockReturnValidator = z.infer<typeof InventoryStockReturnValidator>
