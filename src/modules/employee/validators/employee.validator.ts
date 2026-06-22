import { z } from "zod"

export const CreateEmployeeValidator = z.object({
    name: z.string().trim().min(1, "Name is required"),
    employeeId: z.string().trim().min(1, "Employee ID is required"),
    jobPosition: z.string().trim().min(1, "Job position is required"),
    email: z.string().trim().email("Invalid email format"),
    phone: z.string().trim().min(1, "Phone is required"),
    photo: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
})

export type CreateEmployeeValidator = z.infer<typeof CreateEmployeeValidator>

export const UpdateEmployeeValidator = z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    employeeId: z.string().trim().min(1, "Employee ID is required").optional(),
    jobPosition: z.string().trim().min(1, "Job position is required").optional(),
    email: z.string().trim().email("Invalid email format").optional(),
    phone: z.string().trim().min(1, "Phone is required").optional(),
    photo: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
})

export type UpdateEmployeeValidator = z.infer<typeof UpdateEmployeeValidator>
