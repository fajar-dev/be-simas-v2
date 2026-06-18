import { z } from "zod"

export const CreateAssetValidator = z.object({
    code: z.string().min(1, "Code is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    price: z.number().int().optional().nullable(),
    purchaseDate: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    subCategoryId: z.number().int().positive("Sub category is required"),
})

export type CreateAssetValidator = z.infer<typeof CreateAssetValidator>

export const UpdateAssetValidator = z.object({
    code: z.string().min(1, "Code is required").optional(),
    name: z.string().min(1, "Name is required").optional(),
    description: z.string().optional(),
    price: z.number().int().optional().nullable(),
    purchaseDate: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    subCategoryId: z.number().int().positive("Sub category is required").optional(),
})

export type UpdateAssetValidator = z.infer<typeof UpdateAssetValidator>
