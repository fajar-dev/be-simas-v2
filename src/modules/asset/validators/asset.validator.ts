import { z } from "zod"

const LabelSchema = z.object({
    key: z.string().min(1, "Label key is required"),
    value: z.string().min(1, "Label value is required"),
})

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
    labels: z.array(LabelSchema).optional(),
    
    // Immediate assignment
    employeeId: z.number().int().optional().nullable(),
    assignedDate: z.string().optional().nullable(),
    assignNote: z.string().optional().nullable(),

    // Immediate relocation
    locationId: z.number().int().optional().nullable(),
    locationDate: z.string().optional().nullable(),
    locationNote: z.string().optional().nullable(),
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
    labels: z.array(LabelSchema).optional(),
})

export type UpdateAssetValidator = z.infer<typeof UpdateAssetValidator>
