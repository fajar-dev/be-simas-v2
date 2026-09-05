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
let branchA: number
let branchB: number
let inventoryId: number
let variant1: number

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

    const a = await request(app, "/api/branch", { method: "POST", headers: authHeaders, body: { code: "BR-A", name: "Branch A" } })
    branchA = a.body.data.id
    const b = await request(app, "/api/branch", { method: "POST", headers: authHeaders, body: { code: "BR-B", name: "Branch B" } })
    branchB = b.body.data.id

    const p = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "UTP Cable" } })
    inventoryId = p.body.data.id
    const v1 = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { inventoryId, name: "Cat6 305m", unit: "box" } })
    variant1 = v1.body.data.id
})

const setStock = (branchId: number, items: { variantId: number; new: number; used: number }[]) =>
    request(app, "/api/inventory/stock/entry", { method: "POST", headers: authHeaders, body: { branchId, inventoryId, items } })

const qtyAt = async (branchId: number, variantId: number, condition: string) => {
    const res = await request(app, `/api/inventory/stock?branchId=${branchId}&variantId=${variantId}&condition=${condition}`, { headers: authHeaders })
    return res.body.data[0]?.quantity ?? 0
}

describe("Inventory Stock In API", () => {
    test("auth required", async () => {
        expect((await request(app, `/api/inventory-stock-in?inventoryId=${1}`)).status).toBe(401)
        expect((await request(app, "/api/inventory-stock-in", { method: "POST", body: {} })).status).toBe(401)
    })

    test("increments on-hand across branches (not opname)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 2 }])
        const res = await request(app, "/api/inventory-stock-in", {
            method: "POST", headers: authHeaders,
            body: {
                inventoryId, note: "PO-123",
                items: [
                    { branchId: branchA, variantId: variant1, new: 3, used: 0 },
                    { branchId: branchB, variantId: variant1, new: 4, used: 0 },
                ],
            },
        })
        expect(res.status).toBe(201)
        expect(await qtyAt(branchA, variant1, "new")).toBe(8) // 5 + 3
        expect(await qtyAt(branchA, variant1, "used")).toBe(2) // unchanged
        expect(await qtyAt(branchB, variant1, "new")).toBe(4) // new branch
    })

    test("rejects a variant that does not belong to the inventory item", async () => {
        const otherItem = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Other" } })
        const otherVariant = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { inventoryId: otherItem.body.data.id, name: "X" } })
        const res = await request(app, "/api/inventory-stock-in", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, items: [{ branchId: branchA, variantId: otherVariant.body.data.id, new: 1, used: 0 }] },
        })
        expect(res.status).toBe(400)
    })

    test("response returns the created document with its line items", async () => {
        const res = await request(app, "/api/inventory-stock-in", {
            method: "POST", headers: authHeaders,
            body: {
                inventoryId, note: "PO-777",
                items: [
                    { branchId: branchA, variantId: variant1, new: 3, used: 1 },
                    { branchId: branchB, variantId: variant1, new: 4, used: 0 },
                ],
            },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.note).toBe("PO-777")
        expect(res.body.data.createdBy).not.toBeNull()
        // 3 line items: A/new, A/used, B/new (B/used skipped because qty 0)
        expect(res.body.data.items.length).toBe(3)
        expect(res.body.data.items.every((i: any) => i.variant.id === variant1)).toBe(true)
        expect(res.body.data.items[0].branch).not.toBeNull()
    })

    test("history retrievable per inventory item (paginated)", async () => {
        await request(app, "/api/inventory-stock-in", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, note: "PO-1", items: [{ branchId: branchA, variantId: variant1, new: 2, used: 0 }] },
        })
        await request(app, "/api/inventory-stock-in", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, note: "PO-2", items: [{ branchId: branchA, variantId: variant1, new: 1, used: 0 }] },
        })

        const res = await request(app, `/api/inventory-stock-in?inventoryId=${inventoryId}`, { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(2)
        expect(res.body.data[0].note).toBe("PO-2") // newest first
        expect(Array.isArray(res.body.data[0].attachments)).toBe(true)
    })

    test("entry does NOT create a stock-in document (only the /inventory-stock-in endpoint does)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const res = await request(app, `/api/inventory-stock-in?inventoryId=${inventoryId}`, { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(0)
    })

    test("history requires inventoryId", async () => {
        const res = await request(app, "/api/inventory-stock-in", { headers: authHeaders })
        expect(res.status).toBe(400)
    })

    test("history 404s for a non-existent inventory item", async () => {
        const res = await request(app, "/api/inventory-stock-in?inventoryId=999999", { headers: authHeaders })
        expect(res.status).toBe(404)
    })
})
