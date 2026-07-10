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

// ── Mock MinIO + e-sign to prevent real connections (same as handover.test) ──
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

mock.module("../src/core/helpers/esign", () => {
    const helper = {
        documentSign: async () => [{ document_id: "test-doc", external_reference_id: "1" }],
    }
    return { esignHelper: helper, EsignHelper: class {}, default: helper }
})

let app: Hono
let authHeaders: Record<string, string>
let branchA: number
let productId: number
let variantId: number
let admin: number
let holder: number

const SIGNED_URL = "https://esign.test/documents/signed-doc.pdf"

const approve = (id: number) =>
    request(app, "/api/webhook/esign", { method: "POST", body: { external_reference_id: String(id), status: "COMPLETED", file_url: SIGNED_URL } })

const qtyAt = async (variantId: number, condition: string) => {
    const res = await request(app, `/api/inventory/stock?branchId=${branchA}&variantId=${variantId}&condition=${condition}`, { headers: authHeaders })
    return res.body.data[0]?.quantity ?? 0
}

const remainingHeld = async (employeeId: number) => {
    const res = await request(app, `/api/inventory/stock/holding?employeeId=${employeeId}&active=true`, { headers: authHeaders })
    return res.body.data.reduce((s: number, h: any) => s + h.quantityRemaining, 0)
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
    authHeaders = (await registerAndLogin(app)).headers

    branchA = (await request(app, "/api/branch", { method: "POST", headers: authHeaders, body: { code: "BR-A", name: "Branch A" } })).body.data.id
    productId = (await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "UTP Cable" } })).body.data.id
    variantId = (await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { productId, name: "Cat6 305m", unit: "box" } })).body.data.id

    admin = (await request(app, "/api/employee", { method: "POST", headers: authHeaders, body: { name: "Admin", employeeId: "ADM-1", jobPosition: "Admin", email: "admin@ex.com", phone: "0800" } })).body.data.id
    holder = (await request(app, "/api/employee", { method: "POST", headers: authHeaders, body: { name: "Holder", employeeId: "HLD-1", jobPosition: "Staff", email: "holder@ex.com", phone: "0801" } })).body.data.id

    await request(app, "/api/inventory/stock/entry", { method: "POST", headers: authHeaders, body: { branchId: branchA, productId, items: [{ variantId, new: 10, used: 0 }] } })
})

describe("Inventory stock handover (assign & return)", () => {
    test("stock assign handover: approve moves branch stock into the receiver's holdings", async () => {
        const create = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: {
                receivedById: holder,
                handedOverById: admin,
                transactionType: "assign",
                itemKind: "stock",
                stockItems: [{ variantId, branchId: branchA, condition: "new", quantity: 4 }],
            },
        })
        expect(create.status).toBe(201)
        expect(create.body.data.itemKind).toBe("stock")
        expect(create.body.data.stockItems.length).toBe(1)

        // Pending: branch stock not yet reduced.
        expect(await qtyAt(variantId, "new")).toBe(10)

        const res = await approve(create.body.data.id)
        expect(res.status).toBe(200)
        expect(res.body.data.handover.status).toBe("approve")

        // Approved: branch new 10 -> 6, holder now holds 4.
        expect(await qtyAt(variantId, "new")).toBe(6)
        expect(await remainingHeld(holder)).toBe(4)
    })

    test("stock return handover: approve returns holder's stock into USED", async () => {
        // First assign 4 to the holder.
        const assign = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: { receivedById: holder, handedOverById: admin, transactionType: "assign", itemKind: "stock", stockItems: [{ variantId, branchId: branchA, condition: "new", quantity: 4 }] },
        })
        await approve(assign.body.data.id)

        // Return 3 (holder hands over to admin).
        const ret = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: { receivedById: admin, handedOverById: holder, transactionType: "return", itemKind: "stock", stockItems: [{ variantId, branchId: branchA, condition: "used", quantity: 3 }] },
        })
        expect(ret.status).toBe(201)
        const res = await approve(ret.body.data.id)
        expect(res.body.data.handover.status).toBe("approve")

        expect(await qtyAt(variantId, "used")).toBe(3) // returned into used
        expect(await qtyAt(variantId, "new")).toBe(6)  // new unchanged since assign
        expect(await remainingHeld(holder)).toBe(1)    // 4 - 3
    })

    test("stock assign handover rejects when branch stock is insufficient", async () => {
        const create = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: { receivedById: holder, handedOverById: admin, transactionType: "assign", itemKind: "stock", stockItems: [{ variantId, branchId: branchA, condition: "new", quantity: 50 }] },
        })
        expect(create.status).toBe(400)
    })

    test("stock return handover rejects when employee does not hold enough", async () => {
        const ret = await request(app, "/api/handover", {
            method: "POST", headers: authHeaders,
            body: { receivedById: admin, handedOverById: holder, transactionType: "return", itemKind: "stock", stockItems: [{ variantId, branchId: branchA, condition: "used", quantity: 2 }] },
        })
        expect(ret.status).toBe(400)
    })
})
