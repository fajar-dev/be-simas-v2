import { z } from "zod"

export const AssignAssetValidator = z.object({
    assetId: z.number({ required_error: "Asset ID is required" }),
    employeeId: z.number({ required_error: "Employee ID is required" }),
    assignedDate: z.string().min(1, "Assigned date is required"),
    assignNote: z.string().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
})

export const ReturnAssetValidator = z.object({
    returnedDate: z.string().min(1, "Returned date is required"),
    returnNote: z.string().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
})

export type AssignAssetValidator = z.infer<typeof AssignAssetValidator>
export type ReturnAssetValidator = z.infer<typeof ReturnAssetValidator>
