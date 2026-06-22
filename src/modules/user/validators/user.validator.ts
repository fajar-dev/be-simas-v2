import { z } from "zod"

export const CreateUserValidator = z.object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email("Invalid email format"),
    password: z.string().trim().min(6, "Password must be at least 6 characters"),
    photo: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
    roleId: z.number().int().positive().nullable().optional(),
    employeeId: z.number().int().positive().nullable().optional(),
})

export type CreateUserValidator = z.infer<typeof CreateUserValidator>

export const UpdateUserValidator = z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    email: z.string().trim().email("Invalid email format").optional(),
    password: z.string().trim().min(6, "Password must be at least 6 characters").optional(),
    photo: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
    roleId: z.number().int().positive().nullable().optional(),
    employeeId: z.number().int().positive().nullable().optional(),
})

export type UpdateUserValidator = z.infer<typeof UpdateUserValidator>
