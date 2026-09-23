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
import { createTransferData } from "./helpers"

// POST /transfer is protected by the API key middleware (x-api-key), not bearer auth.
// Reads the actual configured key so this doesn't break if a local .env sets API_KEY.
const apiKeyHeaders = { "x-api-key": process.env.API_KEY || "dev-api-key-change-me" }

let app: Hono
let authHeaders: Record<string, string>
let subCategoryId: number

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

    const cat = await request(app, "/api/category", { method: "POST", headers: authHeaders, body: { code: "CAT-TR", name: "Cat Transfer" } })
    const sub = await request(app, "/api/sub-category", { method: "POST", headers: authHeaders, body: { code: "SUB-TR", name: "Sub Transfer", categoryId: cat.body.data.id } })
    subCategoryId = sub.body.data.id
})

async function createAsset(code: string): Promise<number> {
    const res = await request(app, "/api/asset", { method: "POST", headers: authHeaders, body: { code, name: "Some Asset", subCategoryId } })
    return res.body.data.id
}

describe("Transfer API", () => {
    // ── Intake (API key) — always exactly one row ───────────────────────────
    test("POST /transfer - requires API key", async () => {
        const res = await request(app, "/api/transfer", { method: "POST", body: createTransferData() })
        expect(res.status).toBe(401)
    })

    test("POST /transfer - rejects a wrong API key", async () => {
        const res = await request(app, "/api/transfer", { method: "POST", headers: { "x-api-key": "wrong" }, body: createTransferData() })
        expect(res.status).toBe(401)
    })

    test("POST /transfer - creates one row holding the given code(s)", async () => {
        const res = await request(app, "/api/transfer", {
            method: "POST",
            headers: apiKeyHeaders,
            body: createTransferData({ code: ["SN-001", "SN-002"], quantity: 2 }),
        })
        expect(res.status).toBe(201)
        expect(res.body.data.code).toEqual(["SN-001", "SN-002"])
        expect(res.body.data.quantity).toBe(2)
        expect(res.body.data.name).toBe("Laptop Dell Latitude")
        expect(res.body.data.status).toBe("pending")
    })

    test("POST /transfer - stores the sender-provided createdBy, defaults to null when omitted", async () => {
        const withSender = await request(app, "/api/transfer", {
            method: "POST",
            headers: apiKeyHeaders,
            body: createTransferData({ createdBy: "warehouse-system" }),
        })
        expect(withSender.status).toBe(201)
        expect(withSender.body.data.createdBy).toBe("warehouse-system")

        const withoutSender = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData() })
        expect(withoutSender.status).toBe(201)
        expect(withoutSender.body.data.createdBy).toBeNull()
    })

    test("POST /transfer - quantity without any code still creates one row", async () => {
        const res = await request(app, "/api/transfer", {
            method: "POST",
            headers: apiKeyHeaders,
            body: createTransferData({ quantity: 4 }),
        })
        expect(res.status).toBe(201)
        expect(res.body.data.quantity).toBe(4)
        expect(res.body.data.code).toEqual([])
    })

    test("POST /transfer - defaults quantity to 1 when omitted", async () => {
        const res = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData() })
        expect(res.status).toBe(201)
        expect(res.body.data.quantity).toBe(1)
        expect(res.body.data.code).toEqual([])
    })

    test("POST /transfer - code can carry fewer or more entries than quantity, stored as-is", async () => {
        const fewer = await request(app, "/api/transfer", {
            method: "POST",
            headers: apiKeyHeaders,
            body: createTransferData({ code: ["SN-A", "SN-B"], quantity: 5 }),
        })
        expect(fewer.body.data.code.length).toBe(2)
        expect(fewer.body.data.quantity).toBe(5)

        const more = await request(app, "/api/transfer", {
            method: "POST",
            headers: apiKeyHeaders,
            body: createTransferData({ code: ["SN-1", "SN-2", "SN-3", "SN-4", "SN-5", "SN-6", "SN-7", "SN-8"], quantity: 4 }),
        })
        expect(more.body.data.code.length).toBe(8)
        expect(more.body.data.quantity).toBe(4)
    })

    test("POST /transfer - validation error when name is missing", async () => {
        const res = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: { quantity: 1 } })
        expect(res.status).toBe(422)
    })

    // ── List / show (bearer auth) ────────────────────────────────────────────
    test("GET /transfer - requires auth", async () => {
        const res = await request(app, "/api/transfer")
        expect(res.status).toBe(401)
    })

    test("GET /transfer - list empty", async () => {
        const res = await request(app, "/api/transfer", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([])
    })

    test("GET /transfer - lists intake rows, search and status filter", async () => {
        await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData({ name: "Monitor LG", code: ["SN-100"] }) })
        await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData({ name: "Keyboard Logitech", quantity: 2 }) })

        const all = await request(app, "/api/transfer", { headers: authHeaders })
        expect(all.body.data.length).toBe(2)

        const search = await request(app, "/api/transfer?q=Monitor", { headers: authHeaders })
        expect(search.body.data.length).toBe(1)
        expect(search.body.data[0].name).toBe("Monitor LG")

        const pending = await request(app, "/api/transfer?status=pending", { headers: authHeaders })
        expect(pending.body.data.length).toBe(2)

        const merged = await request(app, "/api/transfer?status=merged", { headers: authHeaders })
        expect(merged.body.data.length).toBe(0)
    })

    test("GET /transfer/:id - success & 404", async () => {
        const created = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData() })
        const id = created.body.data.id

        const found = await request(app, `/api/transfer/${id}`, { headers: authHeaders })
        expect(found.status).toBe(200)
        expect(found.body.data.id).toBe(id)

        const missing = await request(app, "/api/transfer/999999", { headers: authHeaders })
        expect(missing.status).toBe(404)
    })

    // ── Merge: link to Asset(s) already created via the normal Asset create form ─
    test("POST /transfer/:id/merge - requires auth, links a single asset, and marks the row merged", async () => {
        const created = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData({ code: ["SN-300"] }) })
        const id = created.body.data.id
        const assetId = await createAsset("SN-300")

        const noAuth = await request(app, `/api/transfer/${id}/merge`, { method: "POST", body: { assetIds: [assetId] } })
        expect(noAuth.status).toBe(401)

        const merged = await request(app, `/api/transfer/${id}/merge`, { method: "POST", headers: authHeaders, body: { assetIds: [assetId] } })
        expect(merged.status).toBe(200)
        expect(merged.body.data.status).toBe("merged")
        expect(merged.body.data.mergedAssets.length).toBe(1)
        expect(merged.body.data.mergedAssets[0].id).toBe(assetId)
        expect(merged.body.data.mergedAssets[0].code).toBe("SN-300")
    })

    test("POST /transfer/:id/merge - links multiple assets at once (quantity > 1)", async () => {
        const created = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData({ quantity: 3 }) })
        const id = created.body.data.id
        const assetIds = [await createAsset("SN-M1"), await createAsset("SN-M2"), await createAsset("SN-M3")]

        const merged = await request(app, `/api/transfer/${id}/merge`, { method: "POST", headers: authHeaders, body: { assetIds } })
        expect(merged.status).toBe(200)
        expect(merged.body.data.mergedAssets.length).toBe(3)
        expect(merged.body.data.mergedAssets.map((a: any) => a.code).sort()).toEqual(["SN-M1", "SN-M2", "SN-M3"])
    })

    test("POST /transfer/:id/merge - validation error when assetIds is missing or empty", async () => {
        const created = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData() })
        const id = created.body.data.id

        const missing = await request(app, `/api/transfer/${id}/merge`, { method: "POST", headers: authHeaders, body: {} })
        expect(missing.status).toBe(422)

        const empty = await request(app, `/api/transfer/${id}/merge`, { method: "POST", headers: authHeaders, body: { assetIds: [] } })
        expect(empty.status).toBe(422)
    })

    test("POST /transfer/:id/merge - 404 for a non-existent transfer row or asset", async () => {
        const assetId = await createAsset("SN-301")
        const missingTransfer = await request(app, "/api/transfer/999999/merge", { method: "POST", headers: authHeaders, body: { assetIds: [assetId] } })
        expect(missingTransfer.status).toBe(404)

        const created = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData() })
        const id = created.body.data.id
        const missingAsset = await request(app, `/api/transfer/${id}/merge`, { method: "POST", headers: authHeaders, body: { assetIds: [999999] } })
        expect(missingAsset.status).toBe(404)
    })

    test("POST /transfer/:id/merge - rejects merging an already-merged row", async () => {
        const created = await request(app, "/api/transfer", { method: "POST", headers: apiKeyHeaders, body: createTransferData({ code: ["SN-500"] }) })
        const id = created.body.data.id
        const assetId = await createAsset("SN-500")
        await request(app, `/api/transfer/${id}/merge`, { method: "POST", headers: authHeaders, body: { assetIds: [assetId] } })

        const anotherAssetId = await createAsset("SN-501")
        const again = await request(app, `/api/transfer/${id}/merge`, { method: "POST", headers: authHeaders, body: { assetIds: [anotherAssetId] } })
        expect(again.status).toBe(409)
    })

})
