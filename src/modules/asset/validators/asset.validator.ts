import { z } from "zod"

const LabelSchema = z.object({
    key: z.string().trim().min(1, "Label key is required"),
    value: z.string().trim().min(1, "Label value is required"),
})

export const CreateAssetValidator = z.object({
    code: z.string().trim().min(1, "Code is required"),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().optional(),
    price: z.number().int().optional().nullable(),
    purchaseDate: z.string().trim().optional().nullable(),
    brand: z.string().trim().optional().nullable(),
    model: z.string().trim().optional().nullable(),
    image: z.string().trim().optional().nullable(),
    bleTagMac: z.string().trim().optional().nullable(),
    subCategoryId: z.number().int().positive("Sub category is required"),
    labels: z.array(LabelSchema).optional(),
    hasHolder: z.boolean().default(true).optional(),
    hasMaintenance: z.boolean().default(true).optional(),
    hasLocation: z.boolean().default(true).optional(),
    usefulLife: z.preprocess((v) => (v === '' || v === undefined ? null : Number(v)), z.number().int().positive().optional().nullable()),

    // Optional immediate assign fields
    employeeId: z.number().int().positive().optional().nullable(),
    assignedDate: z.string().trim().optional().nullable(),
    assignNote: z.string().trim().optional().nullable(),
    assignAttachmentIds: z.array(z.number()).optional().nullable(),

    // Optional immediate location fields
    locationId: z.number().int().positive().optional().nullable(),
    locationDate: z.string().trim().optional().nullable(),
    locationNote: z.string().trim().optional().nullable(),
    locationAttachmentIds: z.array(z.number()).optional().nullable(),

    // Optional initial status
    status: z.string().trim().optional().nullable(),
    statusNote: z.string().trim().optional().nullable(),

    // Optional asset attachments
    attachmentIds: z.array(z.number()).optional().nullable(),
}).superRefine((data, ctx) => {
    if (data.usefulLife) {
        if (!data.price) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Price is required when useful life is set", path: ["price"] })
        }
        if (!data.purchaseDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Purchase date is required when useful life is set", path: ["purchaseDate"] })
        }
    }
})

export type CreateAssetValidator = z.infer<typeof CreateAssetValidator>

export const UpdateAssetValidator = z.object({
    code: z.string().trim().min(1, "Code is required").optional(),
    name: z.string().trim().min(1, "Name is required").optional(),
    description: z.string().trim().optional(),
    price: z.number().int().optional().nullable(),
    purchaseDate: z.string().trim().optional().nullable(),
    brand: z.string().trim().optional().nullable(),
    model: z.string().trim().optional().nullable(),
    image: z.string().trim().optional().nullable(),
    bleTagMac: z.string().trim().optional().nullable(),
    subCategoryId: z.number().int().positive("Sub category is required").optional(),
    labels: z.array(LabelSchema).optional(),
    hasHolder: z.boolean().optional(),
    hasMaintenance: z.boolean().optional(),
    hasLocation: z.boolean().optional(),
    usefulLife: z.preprocess((v) => (v === '' || v === undefined ? null : Number(v)), z.number().int().positive().optional().nullable()),
    attachmentIds: z.array(z.number()).optional().nullable(),
}).superRefine((data, ctx) => {
    if (data.usefulLife) {
        if (!data.price) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Price is required when useful life is set", path: ["price"] })
        }
        if (!data.purchaseDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Purchase date is required when useful life is set", path: ["purchaseDate"] })
        }
    }
})

export type UpdateAssetValidator = z.infer<typeof UpdateAssetValidator>

export const BulkDeleteAssetValidator = z.object({
    ids: z.array(z.number("Asset ID is required")).min(1, "At least one asset ID is required"),
})
export type BulkDeleteAssetValidator = z.infer<typeof BulkDeleteAssetValidator>
