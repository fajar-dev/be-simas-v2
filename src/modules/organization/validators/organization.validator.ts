import { z } from "zod"

export const CreateOrganizationValidator = z.object({
    name: z.string().trim().min(1, "Name is required"),
    type: z.string().trim().min(1, "Type is required"),
    description: z.string().trim().optional().nullable(),
    parentId: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
})

export type CreateOrganizationValidator = z.infer<typeof CreateOrganizationValidator>

export const UpdateOrganizationValidator = z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    type: z.string().trim().min(1, "Type is required").optional(),
    description: z.string().trim().optional().nullable(),
    parentId: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
})

export type UpdateOrganizationValidator = z.infer<typeof UpdateOrganizationValidator>
