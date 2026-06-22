import { z } from "zod"

export const CreateRoleValidator = z.object({
    name: z.string().trim().min(1, "Name is required"),
    permissionIds: z.array(z.number().int().positive()).min(1, "At least one permission is required"),
})

export type CreateRoleValidator = z.infer<typeof CreateRoleValidator>

export const UpdateRoleValidator = z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    permissionIds: z.array(z.number().int().positive()).optional(),
})

export type UpdateRoleValidator = z.infer<typeof UpdateRoleValidator>
