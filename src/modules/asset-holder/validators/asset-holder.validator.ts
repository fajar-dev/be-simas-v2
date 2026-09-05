import { z } from "zod"
import { ASSET_HOLDER_KINDS } from "../../../core/enums"

export const AssignAssetValidator = z.object({
    assetId: z.number(),
    // Default keeps old employee-only clients working.
    holderKind: z.enum(ASSET_HOLDER_KINDS).default("employee"),
    employeeId: z.number().int().positive().optional().nullable(),
    organizationId: z.number().int().positive().optional().nullable(),
    assignedDate: z.string().trim().min(1, "Assigned date is required"),
    assignNote: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
}).superRefine((data, ctx) => {
    if (data.holderKind === "employee") {
        if (!data.employeeId) {
            ctx.addIssue({ code: "custom", message: "Employee ID is required", path: ["employeeId"] })
        }
        if (data.organizationId) {
            ctx.addIssue({ code: "custom", message: "Organization ID must not be set when holderKind is employee", path: ["organizationId"] })
        }
    } else {
        if (!data.organizationId) {
            ctx.addIssue({ code: "custom", message: "Organization ID is required", path: ["organizationId"] })
        }
        if (data.employeeId) {
            ctx.addIssue({ code: "custom", message: "Employee ID must not be set when holderKind is organization", path: ["employeeId"] })
        }
    }
})

export const ReturnAssetValidator = z.object({
    returnedDate: z.string().trim().min(1, "Returned date is required"),
    returnNote: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
})

// Which fields are actually settable depends on whether the record has been returned yet —
// enforced in AssetHolderService.update() since that's runtime state, not something Zod can see.
export const UpdateAssetHolderValidator = z.object({
    holderKind: z.enum(ASSET_HOLDER_KINDS).optional(),
    employeeId: z.number().int().positive().optional().nullable(),
    organizationId: z.number().int().positive().optional().nullable(),
    assignedDate: z.string().trim().min(1).optional(),
    assignNote: z.string().trim().optional().nullable(),
    returnedDate: z.string().trim().min(1).optional(),
    returnNote: z.string().trim().optional().nullable(),
    attachmentIds: z.array(z.number()).optional(),
}).superRefine((data, ctx) => {
    if (data.employeeId && data.organizationId) {
        ctx.addIssue({ code: "custom", message: "Cannot set both employeeId and organizationId", path: ["organizationId"] })
    }
})

export type AssignAssetValidator = z.infer<typeof AssignAssetValidator>
export type ReturnAssetValidator = z.infer<typeof ReturnAssetValidator>
export type UpdateAssetHolderValidator = z.infer<typeof UpdateAssetHolderValidator>
