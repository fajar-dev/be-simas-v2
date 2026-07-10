import { z } from "zod"
import { HANDOVER_FIELD_TYPES } from "../../../core/enums"

const FieldValidator = z.object({
    label: z.string().trim().min(1, "Label is required"),
    type: z.enum(HANDOVER_FIELD_TYPES),
    options: z.array(z.string().trim().min(1)).optional().nullable(),
    required: z.boolean().optional(),
}).refine(
    (f) => !["select", "radio"].includes(f.type) || (f.options && f.options.length > 0),
    { message: "Options are required for select/radio fields", path: ["options"] }
)

export const ReplaceHandoverFieldsValidator = z.object({
    fields: z.array(FieldValidator),
})

export type ReplaceHandoverFieldsValidator = z.infer<typeof ReplaceHandoverFieldsValidator>
