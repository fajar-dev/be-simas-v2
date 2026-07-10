import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { Hono } from "hono"
import {
    initTestDatabase,
    destroyTestDatabase,
    cleanTestDatabase,
    createTestApp,
    request,
    registerAndLogin,
} from "./setup"

let app: Hono
let authHeaders: Record<string, string>

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
})

describe("Handover Field API", () => {
    test("GET /api/handover-field - requires auth", async () => {
        const res = await request(app, "/api/handover-field?transactionType=assign")
        expect(res.status).toBe(401)
    })

    test("GET /api/handover-field - invalid transactionType", async () => {
        const res = await request(app, "/api/handover-field?transactionType=foo", { headers: authHeaders })
        expect(res.status).toBe(400)
    })

    test("GET /api/handover-field - empty by default", async () => {
        const res = await request(app, "/api/handover-field?transactionType=assign", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(0)
    })

    test("PUT /api/handover-field/:type - replace set & derive keys", async () => {
        const res = await request(app, "/api/handover-field/assign", {
            method: "PUT", headers: authHeaders,
            body: { fields: [
                { label: "PIC Name", type: "text", required: true },
                { label: "Condition", type: "select", options: ["Good", "Damaged"], required: false },
            ] },
        })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(2)
        expect(res.body.data[0].key).toBe("pic_name")
        expect(res.body.data[0].required).toBe(true)
        expect(res.body.data[1].type).toBe("select")
        expect(res.body.data[1].options).toEqual(["Good", "Damaged"])

        // Persisted & scoped to the type
        const get = await request(app, "/api/handover-field?transactionType=assign", { headers: authHeaders })
        expect(get.body.data.length).toBe(2)
        const other = await request(app, "/api/handover-field?transactionType=return", { headers: authHeaders })
        expect(other.body.data.length).toBe(0)
    })

    test("PUT /api/handover-field/:type - replaces previous set", async () => {
        await request(app, "/api/handover-field/assign", { method: "PUT", headers: authHeaders, body: { fields: [{ label: "A", type: "text" }, { label: "B", type: "text" }] } })
        const res = await request(app, "/api/handover-field/assign", { method: "PUT", headers: authHeaders, body: { fields: [{ label: "C", type: "text" }] } })
        expect(res.body.data.length).toBe(1)
        expect(res.body.data[0].label).toBe("C")
    })

    test("PUT /api/handover-field/:type - options required for select", async () => {
        const res = await request(app, "/api/handover-field/assign", {
            method: "PUT", headers: authHeaders,
            body: { fields: [{ label: "Bad", type: "select" }] },
        })
        expect(res.status).toBe(422)
    })
})
