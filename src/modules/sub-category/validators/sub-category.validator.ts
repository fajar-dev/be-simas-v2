import { z } from "zod"

export const CreateSubCategoryValidator = z.object({
    code: z.string().trim().optional(),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().optional(),
    categoryId: z.number().int().positive("Category is required"),
})

export type CreateSubCategoryValidator = z.infer<typeof CreateSubCategoryValidator>

export const UpdateSubCategoryValidator = z.object({
    code: z.string().trim().optional(),
    name: z.string().trim().min(1, "Name is required").optional(),
    description: z.string().trim().optional(),
    categoryId: z.number().int().positive("Category is required").optional(),
})

export type UpdateSubCategoryValidator = z.infer<typeof UpdateSubCategoryValidator>
