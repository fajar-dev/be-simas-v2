import { z } from "zod"

export const CreateCategoryValidator = z.object({
    code: z.string().trim().optional(),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().optional(),
})

export type CreateCategoryValidator = z.infer<typeof CreateCategoryValidator>

export const UpdateCategoryValidator = z.object({
    code: z.string().trim().optional(),
    name: z.string().trim().min(1, "Name is required").optional(),
    description: z.string().trim().optional(),
})

export type UpdateCategoryValidator = z.infer<typeof UpdateCategoryValidator>
