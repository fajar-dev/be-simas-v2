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
import { createHandoverData } from "./helpers"

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
    test("GET /api/handover - requires auth", async () => {
        const res = await request(app, "/api/handover")
        expect(res.status).toBe(401)
    })

    test("POST /api/handover - requires auth", async () => {
        const res = await request(app, "/api/handover", { method: "POST", body: {} })
        expect(res.status).toBe(401)
    })

    // ── Create ────────────────────────────────────────────────────────────────
    test("POST /api/handover - create success (multiple items)", async () => {
        const payload = createHandoverData([
            { assetId, note: "Keterangan item A" },
            { assetId: assetId2 },
        ], employeeId)
        const res = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: payload })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.status).toBe("pending")
        expect(res.body.data.transactionType).toBe("assign")
        expect(res.body.data.note).toBe("Operational use")
        expect(res.body.data.items.length).toBe(2)
        expect(res.body.data.createdBy.name).toBe("Test User")
        expect(res.body.data.items[0].asset.code).toBe("AST-HO01")
        expect(res.body.data.received.name).toBe("Alice")
        expect(res.body.data.items[0].note).toBe("Keterangan item A")
    })

    test("POST /api/handover - validation error when items empty", async () => {
        const res = await request(app, "/api/handover", {
            method: "POST",
            headers: authHeaders,
            body: createHandoverData([], employeeId),
        })
        expect(res.status).toBe(422)
    })

    test("POST /api/handover - reject asset that already has active holder", async () => {
        // Assign holder directly
        await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-01" },
        })

        const res = await request(app, "/api/handover", {
            method: "POST",
            headers: authHeaders,
            body: createHandoverData([{ assetId }], employeeId),
        })
        expect(res.status).toBe(400)
    })

    test("POST /api/handover - reject asset already in another pending handover", async () => {
        await request(app, "/api/handover", {
            method: "POST",
            headers: authHeaders,
            body: createHandoverData([{ assetId }], employeeId),
        })
        const res = await request(app, "/api/handover", {
            method: "POST",
            headers: authHeaders,
            body: createHandoverData([{ assetId }], employeeId),
        })
        expect(res.status).toBe(400)
    })

    test("POST /api/handover - reject duplicate asset in same payload", async () => {
        const res = await request(app, "/api/handover", {
            method: "POST",
            headers: authHeaders,
            body: createHandoverData([
                { assetId },
                { assetId },
            ], employeeId),
        })
        expect(res.status).toBe(400)
    })

    // ── List & Show ──────────────────────────────────────────────────────────
    test("GET /api/handover - list empty", async () => {
        const res = await request(app, "/api/handover", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(0)
        expect(res.body.meta.total).toBe(0)
    })

    test("GET /api/handover - list with data & status filter", async () => {
        await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })

        const res = await request(app, "/api/handover?status=pending", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(1)

        const none = await request(app, "/api/handover?status=approve", { headers: authHeaders })
        expect(none.body.data.length).toBe(0)
    })

    test("GET /api/handover/:id - success & 404", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const ok = await request(app, `/api/handover/${id}`, { headers: authHeaders })
        expect(ok.status).toBe(200)
        expect(ok.body.data.id).toBe(id)

        const notFound = await request(app, "/api/handover/999999", { headers: authHeaders })
        expect(notFound.status).toBe(404)
    })

    // ── Pending blocks manual holder assignment ────────────────────────────────
    test("POST /api/asset-holder - blocked while asset in pending handover", async () => {
        await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })

        const res = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-05" },
        })
        expect(res.status).toBe(400)
    })

    // ── Generated e-sign form attachment ───────────────────────────────────────
    test("POST /api/handover - attaches generated signing form", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        expect(created.status).toBe(201)

        // The handover PDF is generated, uploaded, and associated on create.
        expect(Array.isArray(created.body.data.attachments)).toBe(true)
        expect(created.body.data.attachments.length).toBe(1)
        expect(created.body.data.attachments[0].mimeType).toBe("application/pdf")

        // And it is returned again on detail fetch.
        const detail = await request(app, `/api/handover/${created.body.data.id}`, { headers: authHeaders })
        expect(detail.body.data.attachments.length).toBe(1)
    })

    // ── Approve via e-sign webhook (COMPLETED) ─────────────────────────────────
    const SIGNED_URL = "https://esign.test/documents/signed-doc.pdf"

    test("POST /api/webhook/esign - COMPLETED approves & auto-assigns holders", async () => {
        const created = await request(app, "/api/handover", {
            method: "POST",
            headers: authHeaders,
            body: createHandoverData([{ assetId }, { assetId: assetId2 }], employeeId),
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
        const detail = await request(app, `/api/handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("approve")
        expect(detail.body.data.attachments.some((a: any) => a.url === SIGNED_URL)).toBe(true)

        // A holder is created per item, and the signed document is attached to it.
        const holder1 = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder1.body.data).not.toBeNull()
        expect(holder1.body.data.employee.id).toBe(employeeId)
        expect(holder1.body.data.assignHandover.id).toBe(id)
        expect(holder1.body.data.attachments.some((a: any) => a.url === SIGNED_URL)).toBe(true)

        const holder2 = await request(app, `/api/asset-holder/active/${assetId2}`, { headers: authHeaders })
        expect(holder2.body.data.employee.id).toBe(employeeId)
        expect(holder2.body.data.attachments.some((a: any) => a.url === SIGNED_URL)).toBe(true)
    })

    test("POST /api/webhook/esign - COMPLETED fails when handover not pending", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id
        await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })

        const again = await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })
        expect(again.status).toBe(400)
    })

    // ── Reject via e-sign webhook (non-COMPLETED) ──────────────────────────────
    test("POST /api/webhook/esign - non-COMPLETED rejects handover without assigning holders", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const webhook = await request(app, "/api/webhook/esign", {
            method: "POST",
            body: { external_reference_id: String(id), status: "REJECTED" },
        })
        expect(webhook.status).toBe(200)
        expect(webhook.body.data.handover.status).toBe("reject")

        const detail = await request(app, `/api/handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("reject")

        // No holder is created on rejection.
        const holder = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder.body.data).toBeNull()
    })

    // ── Cancel (user-initiated, pending only) ──────────────────────────────────
    test("POST /api/handover/:id/cancel - requires auth", async () => {
        const res = await request(app, "/api/handover/1/cancel", { method: "POST", body: {} })
        expect(res.status).toBe(401)
    })

    test("POST /api/handover/:id/cancel - cancels a pending handover without assigning holders", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const res = await request(app, `/api/handover/${id}/cancel`, { method: "POST", headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.status).toBe("cancel")

        const detail = await request(app, `/api/handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("cancel")

        // No holder is created on cancellation.
        const holder = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder.body.data).toBeNull()
    })

    test("POST /api/handover/:id/cancel - frees the asset for reassignment", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        // While pending, manual holder assignment is blocked.
        const blocked = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-05" },
        })
        expect(blocked.status).toBe(400)

        await request(app, `/api/handover/${id}/cancel`, { method: "POST", headers: authHeaders })

        // After cancellation the asset is free again.
        const ok = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-06" },
        })
        expect(ok.status).toBe(201)
    })

    test("POST /api/handover/:id/cancel - cannot cancel an approved handover", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        // Approve via e-sign webhook.
        await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })

        const res = await request(app, `/api/handover/${id}/cancel`, { method: "POST", headers: authHeaders })
        expect(res.status).toBe(400)

        // Status stays approved.
        const detail = await request(app, `/api/handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("approve")
    })

    test("POST /api/handover/:id/cancel - 404 for non-existent handover", async () => {
        const res = await request(app, "/api/handover/999999/cancel", { method: "POST", headers: authHeaders })
        expect(res.status).toBe(404)
    })

    test("POST /api/webhook/esign - COMPLETED cannot approve a cancelled handover", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        await request(app, `/api/handover/${id}/cancel`, { method: "POST", headers: authHeaders })

        const webhook = await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })
        expect(webhook.status).toBe(400)

        const detail = await request(app, `/api/handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.status).toBe("cancel")
    })

    // ── Return handover (serah terima pengembalian) ────────────────────────────
    // Assign `assetId` to `employeeId` (Alice) via an approved handover; returns the active holder id.
    async function assignToAlice(assetIds: number[]): Promise<number> {
        const created = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: createHandoverData(assetIds.map((id) => ({ assetId: id })), employeeId),
        })
        await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(created.body.data.id), status: "COMPLETED", file_url: SIGNED_URL } })
        return created.body.data.id
    }

    // Build a return-handover payload: handedOverBy = holder (Alice), receivedBy = warehouse (Bob).
    const returnPayload = (assetIds: number[]) =>
        createHandoverData(assetIds.map((id) => ({ assetId: id })), employeeId2, { transactionType: "return", handedOverById: employeeId })

    test("POST /api/handover - create return handover (pending) for a held asset", async () => {
        const assignId = await assignToAlice([assetId])

        const res = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: returnPayload([assetId]) })
        expect(res.status).toBe(201)
        expect(res.body.data.status).toBe("pending")
        expect(res.body.data.transactionType).toBe("return")
        // Best-effort child link to the origin assign handover.
        expect(res.body.data.parentHandover?.id).toBe(assignId)
    })

    test("POST /api/handover - return rejects asset not held by the returning employee", async () => {
        await assignToAlice([assetId])
        // handedOverBy = Bob (employeeId2), but asset is held by Alice.
        const body = createHandoverData([{ assetId }], employeeId, { transactionType: "return", handedOverById: employeeId2 })
        const res = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body })
        expect(res.status).toBe(400)
    })

    test("POST /api/handover - return rejects asset with no active holder", async () => {
        const res = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: returnPayload([assetId]) })
        expect(res.status).toBe(400)
    })

    test("POST /api/webhook/esign - approving a return handover releases the holder", async () => {
        await assignToAlice([assetId])
        const ret = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: returnPayload([assetId]) })
        const retId = ret.body.data.id

        const webhook = await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(retId), status: "COMPLETED", file_url: SIGNED_URL } })
        expect(webhook.status).toBe(200)
        expect(webhook.body.data.handover.status).toBe("approve")

        // Asset is now free (no active holder).
        const holder = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder.body.data).toBeNull()
    })

    test("POST /api/handover - partial return (assign 2, return 1)", async () => {
        await assignToAlice([assetId, assetId2])

        const ret = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: returnPayload([assetId]) })
        await request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(ret.body.data.id), status: "COMPLETED", file_url: SIGNED_URL } })

        // assetId returned, assetId2 still held by Alice.
        const h1 = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(h1.body.data).toBeNull()
        const h2 = await request(app, `/api/asset-holder/active/${assetId2}`, { headers: authHeaders })
        expect(h2.body.data).not.toBeNull()
        expect(h2.body.data.employee.id).toBe(employeeId)
    })

    test("POST /api/asset-holder/:id/return - manual return blocked for handover-sourced holder", async () => {
        await assignToAlice([assetId])
        const active = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        const holderId = active.body.data.id

        const res = await request(app, `/api/asset-holder/${holderId}/return`, {
            method: "POST", headers: authHeaders,
            body: { returnedDate: "2026-07-10" },
        })
        expect(res.status).toBe(400)
    })

    test("POST /api/asset-status - blocked while asset is held via a handover", async () => {
        await assignToAlice([assetId])
        const res = await request(app, "/api/asset-status", {
            method: "POST", headers: authHeaders,
            body: { assetId, status: "idle", returnActiveHolders: true },
        })
        expect(res.status).toBe(400)
        // Asset still held (status change rejected, holder untouched).
        const holder = await request(app, `/api/asset-holder/active/${assetId}`, { headers: authHeaders })
        expect(holder.body.data).not.toBeNull()
    })

    test("POST /api/asset-status/bulk - rejects the whole batch if any asset is held via a handover", async () => {
        await assignToAlice([assetId]) // assetId held via handover; assetId2 is free
        const res = await request(app, "/api/asset-status/bulk", {
            method: "POST", headers: authHeaders,
            body: { assetIds: [assetId, assetId2], status: "idle" },
        })
        expect(res.status).toBe(400)
    })

    test("POST /api/asset-status - blocked while asset is in a pending assign handover", async () => {
        // Pending assign handover (not approved) — asset has no active holder yet.
        await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const res = await request(app, "/api/asset-status", {
            method: "POST", headers: authHeaders,
            body: { assetId, status: "idle" },
        })
        expect(res.status).toBe(400)
    })

    // ── Custom fields (snapshot per handover) ──────────────────────────────────
    test("POST /api/handover - snapshots custom field values", async () => {
        await request(app, "/api/handover-field/assign", { method: "PUT", headers: authHeaders, body: { fields: [
            { label: "PIC Name", type: "text", required: true },
            { label: "Condition", type: "select", options: ["Good", "Damaged"] },
        ] } })

        const res = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: createHandoverData([{ assetId }], employeeId, { customFields: { pic_name: "Budi", condition: "Good" } }),
        })
        expect(res.status).toBe(201)
        const cf = res.body.data.customFields
        expect(cf.length).toBe(2)
        expect(cf.find((f: any) => f.key === "pic_name")).toMatchObject({ label: "PIC Name", value: "Budi" })
        expect(cf.find((f: any) => f.key === "condition")).toMatchObject({ value: "Good" })
    })

    test("POST /api/handover - rejects when a required custom field is missing", async () => {
        await request(app, "/api/handover-field/assign", { method: "PUT", headers: authHeaders, body: { fields: [{ label: "PIC Name", type: "text", required: true }] } })
        const res = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: createHandoverData([{ assetId }], employeeId, { customFields: {} }),
        })
        expect(res.status).toBe(400)
    })

    test("POST /api/handover - editing a field definition does NOT affect existing handovers", async () => {
        await request(app, "/api/handover-field/assign", { method: "PUT", headers: authHeaders, body: { fields: [{ label: "PIC Name", type: "text" }] } })
        const created = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: createHandoverData([{ assetId }], employeeId, { customFields: { pic_name: "Budi" } }),
        })
        const id = created.body.data.id

        // Change the field definition afterwards.
        await request(app, "/api/handover-field/assign", { method: "PUT", headers: authHeaders, body: { fields: [{ label: "Different Field", type: "number" }] } })

        // The old handover keeps its original snapshot.
        const detail = await request(app, `/api/handover/${id}`, { headers: authHeaders })
        expect(detail.body.data.customFields).toEqual([{ key: "pic_name", label: "PIC Name", type: "text", value: "Budi" }])
    })

    // ── Unsupported methods (module is create/read + webhook only) ──────────────
    test("PUT & DELETE /api/handover/:id - not supported", async () => {
        const created = await request(app, "/api/handover", { method: "POST", headers: authHeaders, body: createHandoverData([{ assetId }], employeeId) })
        const id = created.body.data.id

        const put = await app.request(`/api/handover/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ note: "x" }),
        })
        expect(put.status).toBe(404)

        const del = await app.request(`/api/handover/${id}`, {
            method: "DELETE",
            headers: { ...authHeaders },
        })
        expect(del.status).toBe(404)
    })
})
