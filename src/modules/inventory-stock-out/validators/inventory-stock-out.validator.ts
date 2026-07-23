import { z } from "zod"
import { STOCK_CONDITIONS, STOCK_OUT_TYPES } from "../../../core/enums"

/**
 * Take stock out of a branch (reduces branch stock). `type: "employee"` requires
 * `employeeId` and creates a returnable stock-out; `type: "other"` (consumed,
 * disposed, sold, etc.) must NOT carry an employeeId and is one-way.
 */
export const InventoryStockAssignValidator = z.object({
    type: z.enum(STOCK_OUT_TYPES),
    employeeId: z.number().optional().nullable(),
    note: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
    items: z.array(z.object({
        variantId: z.number("Variant ID is required"),
        branchId: z.number("Branch ID is required"),
        condition: z.enum(STOCK_CONDITIONS),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
    })).min(1, "At least one item is required"),
}).superRefine((data, ctx) => {
    if (data.type === "employee" && !data.employeeId) {
        ctx.addIssue({ code: "custom", message: "Employee ID is required", path: ["employeeId"] })
    }
    if (data.type === "other" && data.employeeId) {
        ctx.addIssue({ code: "custom", message: "Employee ID must not be set for type \"other\"", path: ["employeeId"] })
    }
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
