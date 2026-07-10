import { z } from "zod"

export const CreateInventoryValidator = z.object({
    code: z.string().trim().optional().nullable(),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
})
export type CreateInventoryValidator = z.infer<typeof CreateInventoryValidator>

export const UpdateInventoryValidator = CreateInventoryValidator.partial()
export type UpdateInventoryValidator = z.infer<typeof UpdateInventoryValidator>
