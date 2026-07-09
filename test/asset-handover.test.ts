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
import { createAssetHandoverData } from "./helpers"

// ── Mock MinIO to prevent real connections ──────────────────────────────────
mock.module("../src/core/helpers/minio", () => {
    const helper = {
        upload: async () => "attachments/test-file.txt",
        getProxyUrl: (name: string) => `http://cdn.test.com/stock/${name}`,
        getPresignedUrl: async (name: string) => `http://cdn.test.com/stock/${name}`,
        delete: async () => {},
        ensureBucket: async () => {},
    }
    return { minio: helper, default: helper }
})

// ── Mock e-sign to prevent real HTTP calls on handover create ───────────────
mock.module("../src/core/helpers/esign", () => {
    const helper = {
        documentSign: async () => [{ document_id: "test-doc", external_reference_id: "1" }],
    }
    return { esignHelper: helper, EsignHelper: class {}, default: helper }
})

let app: Hono
let authHeaders: Record<string, string>
let employeeId: number
let employeeId2: number
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

    // Employees
    const emp1 = await request(app, "/api/employee", {
        method: "POST",
        headers: authHeaders,
        body: { employeeId: "EMP-001", name: "Alice", jobPosition: "Staff", email: "alice@ho.com", phone: "0811" },
    })
    employeeId = emp1.body.data.id

    const emp2 = await request(app, "/api/employee", {
        method: "POST",
        headers: authHeaders,
        body: { employeeId: "EMP-002", name: "Bob", jobPosition: "Staff", email: "bob@ho.com", phone: "0812" },
    })
    employeeId2 = emp2.body.data.id

    // Category + SubCategory
    const cat = await request(app, "/api/category", { method: "POST", headers: authHeaders, body: { code: "CAT-HO", name: "Cat HO" } })
    const sub = await request(app, "/api/sub-category", { method: "POST", headers: authHeaders, body: { code: "SUB-HO", name: "Sub HO", categoryId: cat.body.data.id } })
    const subCategoryId = sub.body.data.id

    // Assets (no holder yet)
    assetId = await createAsset("AST-HO01", "Laptop Dell", subCategoryId)
    assetId2 = await createAsset("AST-HO02", "Monitor LG", subCategoryId)
})

describe("Asset Handover API", () => {
    // ── Auth ────────────────────────────────────────────────────────────────
    test("GET /api/asset-handover - requires auth", async () => {
        const res = await request(app, "/api/asset-handover")
        expect(res.status).toBe(401)
    })

    test("POST /api/asset-handover - requires auth", async () => {
        const res = await request(app, "/api/asset-handover", { method: "POST", body: {} })
        expect(res.status).toBe(401)
    })

    // ── Create ────────────────────────────────────────────────────────────────
    test("POST /api/asset-handover - create success (multiple items)", async () => {
        const payload = createAssetHandoverData([
            { assetId, note: "Keterangan item A" },
            { assetId: assetId2 },
        ], employeeId)
        const res = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: payload })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.status).toBe("pending")
        expect(res.body.data.transactionType).toBe("serah_terima")
        expect(res.body.data.note).toBe("Operational use")
        expect(res.body.data.items.length).toBe(2)
        expect(res.body.data.createdBy.name).toBe("Test User")
        expect(res.body.data.items[0].asset.code).toBe("AST-HO01")
        expect(res.body.data.received.name).toBe("Alice")
        expect(res.body.data.items[0].note).toBe("Keterangan item A")
    })

    test("POST /api/asset-handover - validation error when items empty", async () => {
        const res = await request(app, "/api/asset-handover", {
            method: "POST",
            headers: authHeaders,
            body: createAssetHandoverData([], employeeId),
        })
        expect(res.status).toBe(422)
    })

    test("POST /api/asset-handover - reject asset that already has active holder", async () => {
        // Assign holder directly
        await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-01" },
        })

        const res = await request(app, "/api/asset-handover", {
            method: "POST",
            headers: authHeaders,
            body: createAssetHandoverData([{ assetId }], employeeId),
        })
        expect(res.status).toBe(400)
    })

    test("POST /api/asset-handover - reject asset already in another pending handover", async () => {
        await request(app, "/api/asset-handover", {
            method: "POST",
            headers: authHeaders,
            body: createAssetHandoverData([{ assetId }], employeeId),
        })
        const res = await request(app, "/api/asset-handover", {
            method: "POST",
            headers: authHeaders,
            body: createAssetHandoverData([{ assetId }], employeeId),
        })
        expect(res.status).toBe(400)
    })

    test("POST /api/asset-handover - reject duplicate asset in same payload", async () => {
        const res = await request(app, "/api/asset-handover", {
            method: "POST",
            headers: authHeaders,
            body: createAssetHandoverData([
                { assetId },
                { assetId },
            ], employeeId),
        })
        expect(res.status).toBe(400)
    })

    // ── List & Show ──────────────────────────────────────────────────────────
    test("GET /api/asset-handover - list empty", async () => {
        const res = await request(app, "/api/asset-handover", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(0)
        expect(res.body.meta.total).toBe(0)
    })

    test("GET /api/asset-handover - list with data & status filter", async () => {
        await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })

        const res = await request(app, "/api/asset-handover?status=pending", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(1)

        const none = await request(app, "/api/asset-handover?status=approve", { headers: authHeaders })
        expect(none.body.data.length).toBe(0)
    })

    test("GET /api/asset-handover/:id - success & 404", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const ok = await request(app, `/api/asset-handover/${id}`, { headers: authHeaders })
        expect(ok.status).toBe(200)
        expect(ok.body.data.id).toBe(id)

        const notFound = await request(app, "/api/asset-handover/999999", { headers: authHeaders })
        expect(notFound.status).toBe(404)
    })

    // ── Pending blocks manual holder assignment ────────────────────────────────
    test("POST /api/asset-holder - blocked while asset in pending handover", async () => {
        await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })

        const res = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-05" },
        })
        expect(res.status).toBe(400)
    })

    // ── Generated e-sign form attachment ───────────────────────────────────────
    test("POST /api/asset-handover - attaches generated signing form", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        expect(created.status).toBe(201)

        // The handover PDF is generated, uploaded, and associated on create.
        expect(Array.isArray(created.body.data.attachments)).toBe(true)
        expect(created.body.data.attachments.length).toBe(1)
        expect(created.body.data.attachments[0].mimeType).toBe("application/pdf")

        // And it is returned again on detail fetch.
        const detail = await request(app, `/api/asset-handover/${created.body.data.id}`, { headers: authHeaders })
        expect(detail.body.data.attachments.length).toBe(1)
    })

    // ── Approve via e-sign webhook (COMPLETED) ─────────────────────────────────
    const SIGNED_URL = "https://esign.test/documents/signed-doc.pdf"

    test("POST /api/webhook/esign - COMPLETED approves & auto-assigns holders", async () => {
        const created = await request(app, "/api/asset-handover", {
            method: "POST",
            headers: authHeaders,
            body: createAssetHandoverData([{ assetId }, { assetId: assetId2 }], employeeId),
        })
        const id = created.body.data.id

        // Webhook is public (no auth) — approval is driven by the e-sign provider.
        const webhook = await request(app, "/api/webhook/esign", {
            method: "POST",
            body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL },
        })
        expect(webhook.status).toBe(200)
        expect(webhook.body.data.handover.status).toBe("approve")

        // Handover is approved and its attachment now points to the signed URL.
        const detail = await request(app, `/api/asset-handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("approve")
        expect(detail.body.data.attachments.some((a: any) => a.url === SIGNED_URL)).toBe(true)

        // A holder is created per item, and the signed document is attached to it.
        const holder1 = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder1.body.data).not.toBeNull()
        expect(holder1.body.data.employeeId).toBe(employeeId)
        expect(holder1.body.data.handoverId).toBe(id)
        expect(holder1.body.data.attachments.some((a: any) => a.url === SIGNED_URL)).toBe(true)

        const holder2 = await request(app, `/api/asset-holder/active/${assetId2}`, { headers: authHeaders })
        expect(holder2.body.data.employeeId).toBe(employeeId)
        expect(holder2.body.data.attachments.some((a: any) => a.url === SIGNED_URL)).toBe(true)
    })

    test("POST /api/webhook/esign - COMPLETED fails when handover not pending", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id
        await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })

        const again = await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })
        expect(again.status).toBe(400)
    })

    // ── Reject via e-sign webhook (non-COMPLETED) ──────────────────────────────
    test("POST /api/webhook/esign - non-COMPLETED rejects handover without assigning holders", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const webhook = await request(app, "/api/webhook/esign", {
            method: "POST",
            body: { external_reference_id: String(id), status: "REJECTED" },
        })
        expect(webhook.status).toBe(200)
        expect(webhook.body.data.handover.status).toBe("reject")

        const detail = await request(app, `/api/asset-handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("reject")

        // No holder is created on rejection.
        const holder = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder.body.data).toBeNull()
    })

    // ── Cancel (user-initiated, pending only) ──────────────────────────────────
    test("POST /api/asset-handover/:id/cancel - requires auth", async () => {
        const res = await request(app, "/api/asset-handover/1/cancel", { method: "POST", body: {} })
        expect(res.status).toBe(401)
    })

    test("POST /api/asset-handover/:id/cancel - cancels a pending handover without assigning holders", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const res = await request(app, `/api/asset-handover/${id}/cancel`, { method: "POST", headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.status).toBe("cancel")

        const detail = await request(app, `/api/asset-handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("cancel")

        // No holder is created on cancellation.
        const holder = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder.body.data).toBeNull()
    })

    test("POST /api/asset-handover/:id/cancel - frees the asset for reassignment", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        // While pending, manual holder assignment is blocked.
        const blocked = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-05" },
        })
        expect(blocked.status).toBe(400)

        await request(app, `/api/asset-handover/${id}/cancel`, { method: "POST", headers: authHeaders })

        // After cancellation the asset is free again.
        const ok = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-06" },
        })
        expect(ok.status).toBe(201)
    })

    test("POST /api/asset-handover/:id/cancel - cannot cancel an approved handover", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        // Approve via e-sign webhook.
        await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })

        const res = await request(app, `/api/asset-handover/${id}/cancel`, { method: "POST", headers: authHeaders })
        expect(res.status).toBe(400)

        // Status stays approved.
        const detail = await request(app, `/api/asset-handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("approve")
    })

    test("POST /api/asset-handover/:id/cancel - 404 for non-existent handover", async () => {
        const res = await request(app, "/api/asset-handover/999999/cancel", { method: "POST", headers: authHeaders })
        expect(res.status).toBe(404)
    })

    test("POST /api/webhook/esign - COMPLETED cannot approve a cancelled handover", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        await request(app, `/api/asset-handover/${id}/cancel`, { method: "POST", headers: authHeaders })

        const webhook = await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })
        expect(webhook.status).toBe(400)

        const detail = await request(app, `/api/asset-handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("cancel")
    })

    // ── Unsupported methods (module is create/read + webhook only) ──────────────
    test("PUT & DELETE /api/asset-handover/:id - not supported", async () => {
        const created = await request(app, "/api/asset-handover", { method: "POST", headers: authHeaders, body: createAssetHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const put = await app.request(`/api/asset-handover/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ note: "x" }),
        })
        expect(put.status).toBe(404)

        const del = await app.request(`/api/asset-handover/${id}`, {
            method: "DELETE",
            headers: { ...authHeaders },
        })
        expect(del.status).toBe(404)
    })
})
