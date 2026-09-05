import { z } from "zod"

export const CreateInventoryVariantValidator = z.object({
    inventoryId: z.number("Inventory ID is required"),
    name: z.string().trim().min(1, "Name is required"),
    code: z.string().trim().optional().nullable(),
    image: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
})
export type CreateInventoryVariantValidator = z.infer<typeof CreateInventoryVariantValidator>

export const UpdateInventoryVariantValidator = z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    code: z.string().trim().optional().nullable(),
    image: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
})
export type UpdateInventoryVariantValidator = z.infer<typeof UpdateInventoryVariantValidator>
