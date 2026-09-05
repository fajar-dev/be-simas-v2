import type { ScheduleRecurrence } from "../../core/enums"

const MAX_OCCURRENCES = 1000

const pad = (n: number, len: number) => String(n).padStart(len, "0")

const isoToDayNumber = (iso: string): number => {
    const [y, m, d] = iso.split("-").map(Number)
    return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000)
}

const dayNumberToIso = (n: number): string => {
    const dt = new Date(n * 86_400_000)
    return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1, 2)}-${pad(dt.getUTCDate(), 2)}`
}

/** Weekday of an ISO date, 0=Sunday … 6=Saturday. */
const isoWeekday = (iso: string): number => new Date(isoToDayNumber(iso) * 86_400_000).getUTCDay()

/** Last calendar day of month `m` (1-based) in year `y`. */
const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Build an ISO date, or `null` when the day does not exist in that month (e.g. Feb 30). */
const buildIso = (y: number, m: number, d: number): string | null =>
    d > daysInMonth(y, m) ? null : `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`

export interface RecurrenceSpec {
    startDate: string
    recurrence: ScheduleRecurrence
    recurrenceEndDate?: string | null
    daysOfWeek?: number[] | null
    dayOfMonth?: number | null
    month?: number | null
}

/**
 * Expand a (possibly recurring) schedule into the concrete occurrence dates that
 * fall within the inclusive window `[from, to]`. Dates are ISO `YYYY-MM-DD`
 * strings, which sort and compare lexicographically. Pattern dates that don't
 * exist (e.g. the 31st in a 30-day month, Feb 29 in a common year) are skipped.
 *
 * - `none`   → the single `startDate`.
 * - `weekly` → every date on/after `startDate` whose weekday ∈ `daysOfWeek`.
 * - `monthly`→ the `dayOfMonth` of every month, on/after `startDate`.
 * - `yearly` → `month`/`dayOfMonth` of every year, on/after `startDate`.
 */
export function expandOccurrences(schedule: RecurrenceSpec, from: string, to: string): string[] {
    const { startDate, recurrence } = schedule

    // Effective window: never before `startDate`/`from`, never past `to`/`recurrenceEndDate`.
    const end = schedule.recurrenceEndDate && schedule.recurrenceEndDate < to ? schedule.recurrenceEndDate : to
    const lo = from > startDate ? from : startDate
    if (end < from || startDate > end || lo > end) {
        // `none` still needs its exact-date check below; recurring modes have nothing.
        if (recurrence !== "none") return []
    }

    if (recurrence === "none") {
        return startDate >= from && startDate <= to ? [startDate] : []
    }

    const occurrences: string[] = []

    if (recurrence === "weekly") {
        const days = new Set(schedule.daysOfWeek ?? [])
        if (days.size === 0) return []
        const startDay = isoToDayNumber(lo)
        const endDay = isoToDayNumber(end)
        let guard = 0
        for (let day = startDay; day <= endDay && guard++ < MAX_OCCURRENCES; day++) {
            const iso = dayNumberToIso(day)
            if (days.has(isoWeekday(iso))) occurrences.push(iso)
        }
        return occurrences
    }

    // monthly / yearly — iterate by calendar unit.
    const dayOfMonth = schedule.dayOfMonth ?? 1
    const [sy, sm] = startDate.split("-").map(Number) as [number, number]
    const [ey, em] = end.split("-").map(Number) as [number, number]
    const [fy, fm] = from.split("-").map(Number) as [number, number]

    if (recurrence === "monthly") {
        // Fast-forward to the window's first month.
        let y = fy > sy || (fy === sy && fm > sm) ? fy : sy
        let m = fy > sy || (fy === sy && fm > sm) ? fm : sm
        let guard = 0
        while ((y < ey || (y === ey && m <= em)) && guard++ < MAX_OCCURRENCES) {
            const iso = buildIso(y, m, dayOfMonth)
            if (iso && iso >= startDate && iso >= from && iso <= end) occurrences.push(iso)
            m++
            if (m > 12) { m = 1; y++ }
        }
        return occurrences
    }

    // yearly
    const targetMonth = schedule.month ?? 1
    let guard = 0
    for (let y = sy; y <= ey && guard++ < MAX_OCCURRENCES; y++) {
        const iso = buildIso(y, targetMonth, dayOfMonth)
        if (iso && iso >= startDate && iso >= from && iso <= end) occurrences.push(iso)
    }
    return occurrences
}
