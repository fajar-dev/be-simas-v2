import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test"
import { Hono } from "hono"
import {
    initTestDatabase,
    destroyTestDatabase,
    cleanTestDatabase,
    createTestApp,
    request,
    registerAndLogin,
} from "./setup"
import { expandOccurrences } from "../src/modules/asset-schedule/recurrence"

// ── Mock MinIO to prevent real connections (attachments) ────────────────────
mock.module("../src/core/helpers/minio", () => {
    const helper = {
        upload: async () => "attachments/test-file.txt",
        getProxyUrl: (name: string) => `http://cdn.test.com/${name}`,
        getPresignedUrl: async (name: string) => `http://cdn.test.com/${name}`,
        delete: async () => {},
        ensureBucket: async () => {},
    }
    return { minio: helper, default: helper }
})

let app: Hono
let authHeaders: Record<string, string>
let assetId: number
let assetId2: number

async function createAsset(code: string, name: string, subCategoryId: number): Promise<number> {
    const res = await request(app, "/api/asset", {
        method: "POST",
        headers: authHeaders,
        body: { code, name, subCategoryId },
    })
    return res.body.data.id
}

function scheduleData(overrides: Record<string, any> = {}) {
    return {
        assetIds: [assetId],
        title: "Maintenance check",
        description: "Routine servicing",
        startDate: "2026-08-10",
        recurrence: "none",
        ...overrides,
    }
}

beforeAll(async () => {
    await initTestDatabase()
    app = createTestApp()
})

afterAll(async () => {
    await destroyTestDatabase()
})

beforeEach(async () => {
    await cleanTestDatabase()
    const login = await registerAndLogin(app)
    authHeaders = login.headers

    const cat = await request(app, "/api/category", { method: "POST", headers: authHeaders, body: { code: "CAT-SCH", name: "Cat Sch" } })
    const sub = await request(app, "/api/sub-category", { method: "POST", headers: authHeaders, body: { code: "SUB-SCH", name: "Sub Sch", categoryId: cat.body.data.id } })
    const subCategoryId = sub.body.data.id

    assetId = await createAsset("AST-SCH01", "Generator", subCategoryId)
    assetId2 = await createAsset("AST-SCH02", "AC Unit", subCategoryId)
})

// ── Pure recurrence expansion ───────────────────────────────────────────────
describe("expandOccurrences", () => {
    test("non-recurring: emitted only when within range", () => {
        const s = { startDate: "2026-08-10", recurrence: "none" as const }
        expect(expandOccurrences(s, "2026-08-01", "2026-08-31")).toEqual(["2026-08-10"])
        expect(expandOccurrences(s, "2026-09-01", "2026-09-30")).toEqual([])
    })

    test("weekly emits every selected weekday on/after the start", () => {
        // 2026-08-01 is a Saturday. Pick Mon(1) & Wed(3).
        const s = { startDate: "2026-08-01", recurrence: "weekly" as const, daysOfWeek: [1, 3] }
        const out = expandOccurrences(s, "2026-08-01", "2026-08-14")
        expect(out).toEqual(["2026-08-03", "2026-08-05", "2026-08-10", "2026-08-12"])
    })

    test("weekly with no selected days yields nothing", () => {
        const s = { startDate: "2026-08-01", recurrence: "weekly" as const, daysOfWeek: [] }
        expect(expandOccurrences(s, "2026-08-01", "2026-08-31")).toEqual([])
    })

    test("monthly repeats the chosen day, skipping months without it", () => {
        const s = { startDate: "2026-01-01", recurrence: "monthly" as const, dayOfMonth: 31 }
        const out = expandOccurrences(s, "2026-01-01", "2026-05-31")
        // Feb, Apr have no 31st → skipped.
        expect(out).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"])
    })

    test("monthly starts on/after startDate", () => {
        const s = { startDate: "2026-03-20", recurrence: "monthly" as const, dayOfMonth: 15 }
        const out = expandOccurrences(s, "2026-01-01", "2026-06-30")
        // 03-15 is before startDate → first is 04-15.
        expect(out).toEqual(["2026-04-15", "2026-05-15", "2026-06-15"])
    })

    test("yearly repeats the chosen month/day", () => {
        const s = { startDate: "2024-01-01", recurrence: "yearly" as const, month: 2, dayOfMonth: 29 }
        const out = expandOccurrences(s, "2024-01-01", "2028-12-31")
        // Only leap years have Feb 29.
        expect(out).toEqual(["2024-02-29", "2028-02-29"])
    })

    test("recurrenceEndDate caps the series", () => {
        const s = { startDate: "2026-08-01", recurrence: "weekly" as const, daysOfWeek: [1, 3, 5], recurrenceEndDate: "2026-08-07" }
        expect(expandOccurrences(s, "2026-08-01", "2026-08-31")).toEqual(["2026-08-03", "2026-08-05", "2026-08-07"])
    })
})

describe("Asset Schedule API", () => {
    // ── Auth ────────────────────────────────────────────────────────────────
    test("GET /api/asset-schedule - requires auth", async () => {
        const res = await request(app, "/api/asset-schedule")
        expect(res.status).toBe(401)
    })

    test("POST /api/asset-schedule - requires auth", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", body: scheduleData() })
        expect(res.status).toBe(401)
    })

    // ── Create ────────────────────────────────────────────────────────────────
    test("creates a one-off schedule with multiple assets", async () => {
        const res = await request(app, "/api/asset-schedule", {
            method: "POST",
            headers: authHeaders,
            body: scheduleData({ assetIds: [assetId, assetId2] }),
        })
        expect(res.status).toBe(201)
        expect(res.body.data.recurrence).toBe("none")
        const ids = res.body.data.assets.map((a: any) => a.id).sort()
        expect(ids).toEqual([assetId, assetId2].sort())
    })

    test("accepts a null description (empty optional field from the form)", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ description: null }) })
        expect(res.status).toBe(201)
        expect(res.body.data.description).toBeNull()
    })

    test("creates a weekly schedule with selected weekdays", async () => {
        const res = await request(app, "/api/asset-schedule", {
            method: "POST",
            headers: authHeaders,
            body: scheduleData({ recurrence: "weekly", daysOfWeek: [1, 3], recurrenceEndDate: "2026-12-31" }),
        })
        expect(res.status).toBe(201)
        expect(res.body.data.recurrence).toBe("weekly")
        expect(res.body.data.daysOfWeek).toEqual([1, 3])
    })

    test("creates a monthly schedule with a day-of-month", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ recurrence: "monthly", dayOfMonth: 15 }) })
        expect(res.status).toBe(201)
        expect(res.body.data.recurrence).toBe("monthly")
        expect(res.body.data.dayOfMonth).toBe(15)
    })

    test("creates a yearly schedule with month + day", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ recurrence: "yearly", month: 8, dayOfMonth: 10 }) })
        expect(res.status).toBe(201)
        expect(res.body.data.recurrence).toBe("yearly")
        expect(res.body.data.month).toBe(8)
        expect(res.body.data.dayOfMonth).toBe(10)
    })

    test("rejects an empty asset list", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ assetIds: [] }) })
        expect(res.status).toBe(422)
    })

    test("rejects a schedule referencing a non-existent asset", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ assetIds: [assetId, 999999] }) })
        expect(res.status).toBe(404)
    })

    // ── Optional multi-user assignment ──────────────────────────────────────
    test("creates a schedule with no assigned users when userIds is omitted", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData() })
        expect(res.status).toBe(201)
        expect(res.body.data.users).toEqual([])
    })

    test("creates a schedule assigned to multiple users", async () => {
        const u1 = await request(app, "/api/user", { method: "POST", headers: authHeaders, body: { name: "Assignee One", email: "assignee1@example.com", password: "password123" } })
        const u2 = await request(app, "/api/user", { method: "POST", headers: authHeaders, body: { name: "Assignee Two", email: "assignee2@example.com", password: "password123" } })

        const res = await request(app, "/api/asset-schedule", {
            method: "POST",
            headers: authHeaders,
            body: scheduleData({ userIds: [u1.body.data.id, u2.body.data.id] }),
        })
        expect(res.status).toBe(201)
        const ids = res.body.data.users.map((u: any) => u.id).sort()
        expect(ids).toEqual([u1.body.data.id, u2.body.data.id].sort())
    })

    test("rejects a schedule referencing a non-existent user", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ userIds: [999999] }) })
        expect(res.status).toBe(404)
    })

    test("rejects weekly without weekdays", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ recurrence: "weekly" }) })
        expect(res.status).toBe(422)
    })

    test("rejects monthly without a day-of-month", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ recurrence: "monthly" }) })
        expect(res.status).toBe(422)
    })

    test("rejects yearly without a month", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ recurrence: "yearly", dayOfMonth: 10 }) })
        expect(res.status).toBe(422)
    })

    test("rejects invalid date format", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ startDate: "10-08-2026" }) })
        expect(res.status).toBe(422)
    })

    test("rejects a missing title", async () => {
        const res = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ title: "" }) })
        expect(res.status).toBe(422)
    })

    // ── List ────────────────────────────────────────────────────────────────
    test("lists schedules with pagination, search and asset filter", async () => {
        await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ title: "Alpha", assetIds: [assetId] }) })
        await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ title: "Beta", assetIds: [assetId2] }) })

        const all = await request(app, "/api/asset-schedule")
        expect(all.status).toBe(401)

        const listed = await request(app, "/api/asset-schedule?page=1&limit=10", { headers: authHeaders })
        expect(listed.body.data.length).toBe(2)

        const searched = await request(app, "/api/asset-schedule?q=Alpha", { headers: authHeaders })
        expect(searched.body.data.length).toBe(1)
        expect(searched.body.data[0].title).toBe("Alpha")

        const byAsset = await request(app, `/api/asset-schedule?assetId=${assetId2}`, { headers: authHeaders })
        expect(byAsset.body.data.length).toBe(1)
        expect(byAsset.body.data[0].title).toBe("Beta")
    })

    // ── Show / Update / Delete ──────────────────────────────────────────────
    test("shows, updates (incl. assets) and deletes a schedule", async () => {
        const created = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData() })
        const id = created.body.data.id

        const shown = await request(app, `/api/asset-schedule/${id}`, { headers: authHeaders })
        expect(shown.status).toBe(200)
        expect(shown.body.data.assets.map((a: any) => a.id)).toEqual([assetId])

        const updated = await request(app, `/api/asset-schedule/${id}`, {
            method: "PUT",
            headers: authHeaders,
            body: { title: "Renamed", assetIds: [assetId2], recurrence: "monthly", dayOfMonth: 5 },
        })
        expect(updated.status).toBe(200)
        expect(updated.body.data.title).toBe("Renamed")
        expect(updated.body.data.recurrence).toBe("monthly")
        expect(updated.body.data.dayOfMonth).toBe(5)
        expect(updated.body.data.assets.map((a: any) => a.id)).toEqual([assetId2])

        const deleted = await request(app, `/api/asset-schedule/${id}`, { method: "DELETE", headers: authHeaders })
        expect(deleted.status).toBe(200)

        const missing = await request(app, `/api/asset-schedule/${id}`, { headers: authHeaders })
        expect(missing.status).toBe(404)
    })

    test("updates assigned users and can clear them with an explicit empty array", async () => {
        const u1 = await request(app, "/api/user", { method: "POST", headers: authHeaders, body: { name: "Assignee One", email: "upd-assignee1@example.com", password: "password123" } })
        const u2 = await request(app, "/api/user", { method: "POST", headers: authHeaders, body: { name: "Assignee Two", email: "upd-assignee2@example.com", password: "password123" } })

        const created = await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ userIds: [u1.body.data.id] }) })
        const id = created.body.data.id
        expect(created.body.data.users.map((u: any) => u.id)).toEqual([u1.body.data.id])

        // omitting userIds leaves the assignment untouched
        const untouched = await request(app, `/api/asset-schedule/${id}`, { method: "PUT", headers: authHeaders, body: { title: "Still assigned" } })
        expect(untouched.status).toBe(200)
        expect(untouched.body.data.users.map((u: any) => u.id)).toEqual([u1.body.data.id])

        // replacing with a different set
        const replaced = await request(app, `/api/asset-schedule/${id}`, { method: "PUT", headers: authHeaders, body: { userIds: [u2.body.data.id] } })
        expect(replaced.status).toBe(200)
        expect(replaced.body.data.users.map((u: any) => u.id)).toEqual([u2.body.data.id])

        // an explicit empty array clears all assigned users
        const cleared = await request(app, `/api/asset-schedule/${id}`, { method: "PUT", headers: authHeaders, body: { userIds: [] } })
        expect(cleared.status).toBe(200)
        expect(cleared.body.data.users).toEqual([])
    })

    test("clears pattern fields when a schedule reverts to non-recurring", async () => {
        const created = await request(app, "/api/asset-schedule", {
            method: "POST",
            headers: authHeaders,
            body: scheduleData({ recurrence: "weekly", daysOfWeek: [1, 3], recurrenceEndDate: "2026-12-31" }),
        })
        const id = created.body.data.id

        const updated = await request(app, `/api/asset-schedule/${id}`, { method: "PUT", headers: authHeaders, body: { recurrence: "none" } })
        expect(updated.status).toBe(200)
        expect(updated.body.data.recurrence).toBe("none")
        expect(updated.body.data.daysOfWeek).toBeNull()
        expect(updated.body.data.recurrenceEndDate).toBeNull()
    })

    // ── Calendar ────────────────────────────────────────────────────────────
    test("calendar expands weekly schedules into dated occurrences", async () => {
        await request(app, "/api/asset-schedule", {
            method: "POST",
            headers: authHeaders,
            body: scheduleData({ title: "Weekly", startDate: "2026-08-01", recurrence: "weekly", daysOfWeek: [1] }), // Mondays
        })
        await request(app, "/api/asset-schedule", {
            method: "POST",
            headers: authHeaders,
            body: scheduleData({ title: "One-off", startDate: "2026-08-15", recurrence: "none" }),
        })

        const res = await request(app, "/api/asset-schedule/calendar?from=2026-08-01&to=2026-08-31", { headers: authHeaders })
        expect(res.status).toBe(200)

        const weeklyDates = res.body.data.filter((o: any) => o.title === "Weekly").map((o: any) => o.date)
        expect(weeklyDates).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"])

        const oneOff = res.body.data.filter((o: any) => o.title === "One-off")
        expect(oneOff.length).toBe(1)
        expect(oneOff[0].date).toBe("2026-08-15")
        expect(oneOff[0].isRecurring).toBe(false)
        expect(oneOff[0].assets.length).toBe(1)
    })

    test("calendar requires from and to", async () => {
        const res = await request(app, "/api/asset-schedule/calendar?from=2026-08-01", { headers: authHeaders })
        expect(res.status).toBe(400)
    })

    test("calendar can filter by asset", async () => {
        await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ title: "ForA", assetIds: [assetId], startDate: "2026-08-10" }) })
        await request(app, "/api/asset-schedule", { method: "POST", headers: authHeaders, body: scheduleData({ title: "ForB", assetIds: [assetId2], startDate: "2026-08-11" }) })

        const res = await request(app, `/api/asset-schedule/calendar?from=2026-08-01&to=2026-08-31&assetId=${assetId2}`, { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(1)
        expect(res.body.data[0].title).toBe("ForB")
    })
})
