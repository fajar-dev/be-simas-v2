import { z } from "zod"

export const CreateBranchValidator = z.object({
    code: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
})

export type CreateBranchValidator = z.infer<typeof CreateBranchValidator>

export const UpdateBranchValidator = z.object({
    code: z.string().min(1, "Code is required").optional(),
    name: z.string().min(1, "Name is required").optional(),
    description: z.string().optional(),
})

export type UpdateBranchValidator = z.infer<typeof UpdateBranchValidator>
