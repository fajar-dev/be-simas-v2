import { z } from "zod"

const LabelSchema = z.object({
    key: z.string().trim().min(1, "Label key is required"),
    value: z.string().trim().min(1, "Label value is required"),
})

const InitialStockSchema = z.object({
    branchId: z.number().int().positive(),
    new: z.number().int().min(0, "Quantity cannot be negative"),
    used: z.number().int().min(0, "Quantity cannot be negative"),
})

const VariantSchema = z.object({
    name: z.string().trim().min(1, "Variant name is required"),
    code: z.string().trim().optional().nullable(),
    image: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    initialStock: z.array(InitialStockSchema).optional(),
})

export const CreateInventoryValidator = z.object({
    code: z.string().trim().optional().nullable(),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().optional().nullable(),
    image: z.string().trim().optional().nullable(),
    unit: z.string().trim().optional().nullable(),
    subCategoryId: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
    labels: z.array(LabelSchema).optional(),
    variants: z.array(VariantSchema).optional(),
    attachmentIds: z.array(z.number()).optional().nullable(),
})
export type CreateInventoryValidator = z.infer<typeof CreateInventoryValidator>

export const UpdateInventoryValidator = z.object({
    code: z.string().trim().optional().nullable(),
    name: z.string().trim().min(1, "Name is required").optional(),
    description: z.string().trim().optional().nullable(),
    image: z.string().trim().optional().nullable(),
    unit: z.string().trim().optional().nullable(),
    subCategoryId: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
    labels: z.array(LabelSchema).optional(),
    attachmentIds: z.array(z.number()).optional().nullable(),
})
export type UpdateInventoryValidator = z.infer<typeof UpdateInventoryValidator>
