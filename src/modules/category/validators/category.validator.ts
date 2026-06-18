import { z } from "zod"

export const CreateCategoryValidator = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
})

export type CreateCategoryValidator = z.infer<typeof CreateCategoryValidator>

export const UpdateCategoryValidator = z.object({
    name: z.string().min(1, "Name is required").optional(),
    description: z.string().optional(),
})

export type UpdateCategoryValidator = z.infer<typeof UpdateCategoryValidator>
