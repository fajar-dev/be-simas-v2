import { z } from "zod"

export const CreateSubCategoryValidator = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    categoryId: z.number().int().positive("Category is required"),
})

export type CreateSubCategoryValidator = z.infer<typeof CreateSubCategoryValidator>

export const UpdateSubCategoryValidator = z.object({
    name: z.string().min(1, "Name is required").optional(),
    description: z.string().optional(),
    categoryId: z.number().int().positive("Category is required").optional(),
})

export type UpdateSubCategoryValidator = z.infer<typeof UpdateSubCategoryValidator>
