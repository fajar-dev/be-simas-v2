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

describe("Inventory Stock Opname API", () => {
    test("auth required", async () => {
        expect((await request(app, `/api/inventory-stock-opname?inventoryId=${1}`)).status).toBe(401)
        expect((await request(app, "/api/inventory-stock-opname", { method: "POST", body: {} })).status).toBe(401)
    })

    test("sets on-hand to the counted quantity (not an increment)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 2 }])
        const res = await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, note: "Q1 count", items: [{ variantId: variant1, new: 7, used: 2 }] },
        })
        expect(res.status).toBe(201)
        expect(await qtyAt(branchA, variant1, "new")).toBe(7) // set to 7, not 10+7
        expect(await qtyAt(branchA, variant1, "used")).toBe(2) // unchanged
    })

    test("only persists items where the count differs from system quantity", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 5 }])
        const res = await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, items: [{ variantId: variant1, new: 8, used: 5 }] },
        })
        expect(res.status).toBe(201)
        // used matched system quantity (5 == 5) so it's skipped; only "new" recorded
        expect(res.body.data.items.length).toBe(1)
        expect(res.body.data.items[0].condition).toBe("new")
        expect(res.body.data.items[0].systemQuantity).toBe(5)
        expect(res.body.data.items[0].countedQuantity).toBe(8)
        expect(res.body.data.items[0].quantity).toBe(3)
    })

    test("records a negative delta when the count is lower than system quantity", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const res = await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, items: [{ variantId: variant1, new: 6, used: 0 }] },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.items[0].quantity).toBe(-4)
        expect(await qtyAt(branchA, variant1, "new")).toBe(6)
    })

    test("counting a variant with no prior balance sets it from zero", async () => {
        const res = await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchB, items: [{ variantId: variant1, new: 3, used: 0 }] },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.items[0].systemQuantity).toBe(0)
        expect(res.body.data.items[0].countedQuantity).toBe(3)
        expect(await qtyAt(branchB, variant1, "new")).toBe(3)
    })

    test("does not affect other branches", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        await setStock(branchB, [{ variantId: variant1, new: 20, used: 0 }])
        await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, items: [{ variantId: variant1, new: 1, used: 0 }] },
        })
        expect(await qtyAt(branchA, variant1, "new")).toBe(1)
        expect(await qtyAt(branchB, variant1, "new")).toBe(20) // untouched
    })

    test("rejects a variant that does not belong to the inventory item", async () => {
        const otherItem = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Other" } })
        const otherVariant = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { inventoryId: otherItem.body.data.id, name: "X" } })
        const res = await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, items: [{ variantId: otherVariant.body.data.id, new: 1, used: 0 }] },
        })
        expect(res.status).toBe(400)
    })

    test("rejects a non-existent branch", async () => {
        const res = await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: 999999, items: [{ variantId: variant1, new: 1, used: 0 }] },
        })
        expect(res.status).toBe(404)
    })

    test("response returns the created document with its line items and branch", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 0 }])
        const res = await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, note: "Annual count", items: [{ variantId: variant1, new: 9, used: 1 }] },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.note).toBe("Annual count")
        expect(res.body.data.branch.id).toBe(branchA)
        expect(res.body.data.createdBy).not.toBeNull()
        // new: 5 -> 9 (recorded), used: 0 -> 1 (recorded)
        expect(res.body.data.items.length).toBe(2)
        expect(res.body.data.items.every((i: any) => i.variant.id === variant1)).toBe(true)
    })

    test("history retrievable per inventory item (paginated)", async () => {
        await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, note: "Count 1", items: [{ variantId: variant1, new: 2, used: 0 }] },
        })
        await request(app, "/api/inventory-stock-opname", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, branchId: branchA, note: "Count 2", items: [{ variantId: variant1, new: 1, used: 0 }] },
        })

        const res = await request(app, `/api/inventory-stock-opname?inventoryId=${inventoryId}`, { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(2)
        expect(res.body.data[0].note).toBe("Count 2") // newest first
        expect(Array.isArray(res.body.data[0].attachments)).toBe(true)
    })

    test("entry does NOT create a stock-opname document (only the /inventory-stock-opname endpoint does)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const res = await request(app, `/api/inventory-stock-opname?inventoryId=${inventoryId}`, { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(0)
    })

    test("history requires inventoryId", async () => {
        const res = await request(app, "/api/inventory-stock-opname", { headers: authHeaders })
        expect(res.status).toBe(400)
    })

    test("history 404s for a non-existent inventory item", async () => {
        const res = await request(app, "/api/inventory-stock-opname?inventoryId=999999", { headers: authHeaders })
        expect(res.status).toBe(404)
    })
})
