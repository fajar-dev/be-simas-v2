import { z } from "zod"

export const CreateLocationValidator = z.object({
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().optional(),
    branchId: z.number().int().positive("Branch is required"),
})

export type CreateLocationValidator = z.infer<typeof CreateLocationValidator>

export const UpdateLocationValidator = z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    description: z.string().trim().optional(),
    branchId: z.number().int().positive("Branch is required").optional(),
})

export type UpdateLocationValidator = z.infer<typeof UpdateLocationValidator>
