import { z } from "zod"
import { SCHEDULE_RECURRENCES } from "../../../core/enums"

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm format")
const weekday = z.number().int().min(0, "Weekday must be 0–6").max(6, "Weekday must be 0–6")
const dayOfMonth = z.number().int().min(1, "Day of month must be 1–31").max(31, "Day of month must be 1–31")
const monthNumber = z.number().int().min(1, "Month must be 1–12").max(12, "Month must be 1–12")

/** Shared cross-field checks for the recurrence pattern (create requires the fields; update reuses this too). */
function validateRecurrence(
    data: {
        recurrence?: string
        daysOfWeek?: number[] | null
        dayOfMonth?: number | null
        month?: number | null
        startDate?: string
        recurrenceEndDate?: string | null
        startTime?: string | null
        endTime?: string | null
    },
    ctx: z.RefinementCtx
) {
    const r = data.recurrence
    if (r === "weekly" && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["daysOfWeek"], message: "Pick at least one weekday for a weekly schedule" })
    }
    if (r === "monthly" && (data.dayOfMonth === undefined || data.dayOfMonth === null)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dayOfMonth"], message: "Day of month is required for a monthly schedule" })
    }
    if (r === "yearly") {
        if (data.month === undefined || data.month === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["month"], message: "Month is required for a yearly schedule" })
        }
        if (data.dayOfMonth === undefined || data.dayOfMonth === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dayOfMonth"], message: "Day of month is required for a yearly schedule" })
        }
    }
    if (r === "none" && data.recurrenceEndDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrenceEndDate"], message: "Recurrence end date is only allowed for a recurring schedule" })
    }
    if (data.recurrenceEndDate && data.startDate && data.recurrenceEndDate < data.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrenceEndDate"], message: "Recurrence end date must be on or after the start date" })
    }
    if (data.startTime && data.endTime && data.endTime < data.startTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "End time must be on or after the start time" })
    }
}

export const CreateAssetScheduleValidator = z
    .object({
        assetIds: z.array(z.number().int().positive()).min(1, "At least one asset is required"),
        title: z.string().min(1, "Title is required"),
        description: z.string().optional().nullable(),
        startDate: dateString,
        startTime: timeString.optional().nullable(),
        endTime: timeString.optional().nullable(),
        recurrence: z.enum(SCHEDULE_RECURRENCES).default("none"),
        daysOfWeek: z.array(weekday).optional().nullable(),
        dayOfMonth: dayOfMonth.optional().nullable(),
        month: monthNumber.optional().nullable(),
        recurrenceEndDate: dateString.optional().nullable(),
        attachmentIds: z.array(z.number()).optional(),
    })
    .superRefine(validateRecurrence)

export type CreateAssetScheduleValidator = z.infer<typeof CreateAssetScheduleValidator>

export const UpdateAssetScheduleValidator = z
    .object({
        assetIds: z.array(z.number().int().positive()).min(1, "At least one asset is required").optional(),
        title: z.string().min(1, "Title is required").optional(),
        description: z.string().optional().nullable(),
        startDate: dateString.optional(),
        startTime: timeString.optional().nullable(),
        endTime: timeString.optional().nullable(),
        recurrence: z.enum(SCHEDULE_RECURRENCES).optional(),
        daysOfWeek: z.array(weekday).optional().nullable(),
        dayOfMonth: dayOfMonth.optional().nullable(),
        month: monthNumber.optional().nullable(),
        recurrenceEndDate: dateString.optional().nullable(),
        attachmentIds: z.array(z.number()).optional(),
    })
    .superRefine((data, ctx) => {
        // Only enforce recurrence-pattern requirements when the recurrence itself is being set.
        if (data.recurrence !== undefined) validateRecurrence(data, ctx)
        else if (data.startTime && data.endTime && data.endTime < data.startTime) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "End time must be on or after the start time" })
        }
    })

export type UpdateAssetScheduleValidator = z.infer<typeof UpdateAssetScheduleValidator>
