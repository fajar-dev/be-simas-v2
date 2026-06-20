import { z } from "zod"

const DEPRECIATION_METHODS = ["none", "straight_line", "declining_balance"] as const

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
    hasHolder: z.boolean().default(true).optional(),
    hasMaintenance: z.boolean().default(true).optional(),
    hasLocation: z.boolean().default(true).optional(),

    // Depreciation fields
    depreciationMethod: z.enum(DEPRECIATION_METHODS).default("none").optional(),
    usefulLife: z.number().int().positive("Useful life must be positive").optional().nullable(),
    residualValue: z.number().int().min(0, "Residual value cannot be negative").optional().nullable(),
    depreciationStartDate: z.string().optional().nullable(),

    // Optional immediate assign fields
    employeeId: z.number().int().positive().optional().nullable(),
    assignedDate: z.string().optional().nullable(),
    assignNote: z.string().optional().nullable(),
    assignAttachmentIds: z.array(z.number()).optional().nullable(),

    // Optional immediate location fields
    locationId: z.number().int().positive().optional().nullable(),
    locationDate: z.string().optional().nullable(),
    locationNote: z.string().optional().nullable(),
    locationAttachmentIds: z.array(z.number()).optional().nullable(),
}).refine(
    (data) => {
        if (data.depreciationMethod && data.depreciationMethod !== "none") {
            return data.usefulLife !== undefined && data.usefulLife !== null && data.usefulLife > 0
        }
        return true
    },
    { message: "Useful life is required when depreciation method is set", path: ["usefulLife"] }
)

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
    hasHolder: z.boolean().optional(),
    hasMaintenance: z.boolean().optional(),
    hasLocation: z.boolean().optional(),

    // Depreciation fields
    depreciationMethod: z.enum(DEPRECIATION_METHODS).optional(),
    usefulLife: z.number().int().positive("Useful life must be positive").optional().nullable(),
    residualValue: z.number().int().min(0, "Residual value cannot be negative").optional().nullable(),
    depreciationStartDate: z.string().optional().nullable(),
}).refine(
    (data) => {
        if (data.depreciationMethod && data.depreciationMethod !== "none") {
            return data.usefulLife !== undefined && data.usefulLife !== null && data.usefulLife > 0
        }
        return true
    },
    { message: "Useful life is required when depreciation method is set", path: ["usefulLife"] }
)

export type UpdateAssetValidator = z.infer<typeof UpdateAssetValidator>
