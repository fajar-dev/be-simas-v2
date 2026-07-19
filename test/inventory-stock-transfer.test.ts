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
let variant2: number

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
    const v2 = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { inventoryId, name: "Cat5e 100m" } })
    variant2 = v2.body.data.id
})

const setStock = (branchId: number, items: { variantId: number; new: number; used: number }[]) =>
    request(app, "/api/inventory/stock/entry", { method: "POST", headers: authHeaders, body: { branchId, inventoryId, items } })

describe("Inventory Stock Transfer API", () => {
    test("auth required", async () => {
        expect((await request(app, `/api/inventory-stock-transfer?inventoryId=${1}`)).status).toBe(401)
        expect((await request(app, "/api/inventory-stock-transfer", { method: "POST", body: {} })).status).toBe(401)
    })

    test("moves only the given condition; source decrements, dest increments", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 4 }])

        const res = await request(app, "/api/inventory-stock-transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchB, items: [{ variantId: variant1, condition: "used", quantity: 3 }] },
        })
        expect(res.status).toBe(200)

        // Source: used 4 -> 1, new untouched (10)
        const srcUsed = await request(app, `/api/inventory/stock?branchId=${branchA}&variantId=${variant1}&condition=used`, { headers: authHeaders })
        expect(srcUsed.body.data[0].quantity).toBe(1)
        const srcNew = await request(app, `/api/inventory/stock?branchId=${branchA}&variantId=${variant1}&condition=new`, { headers: authHeaders })
        expect(srcNew.body.data[0].quantity).toBe(10)

        // Dest: used 0 -> 3
        const dstUsed = await request(app, `/api/inventory/stock?branchId=${branchB}&variantId=${variant1}&condition=used`, { headers: authHeaders })
        expect(dstUsed.body.data[0].quantity).toBe(3)
    })

    test("rejects when source stock is insufficient (no negative)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 0, used: 2 }])
        const res = await request(app, "/api/inventory-stock-transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchB, items: [{ variantId: variant1, condition: "used", quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        const src = await request(app, `/api/inventory/stock?branchId=${branchA}&variantId=${variant1}&condition=used`, { headers: authHeaders })
        expect(src.body.data[0].quantity).toBe(2) // unchanged
    })

    test("rejects same source & destination branch", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 0 }])
        const res = await request(app, "/api/inventory-stock-transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchA, items: [{ variantId: variant1, condition: "new", quantity: 1 }] },
        })
        expect(res.status).toBe(400)
    })

    test("rejects duplicate variant+condition within one transfer", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const res = await request(app, "/api/inventory-stock-transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchB, items: [
                { variantId: variant1, condition: "new", quantity: 2 },
                { variantId: variant1, condition: "new", quantity: 3 },
            ] },
        })
        expect(res.status).toBe(400)
    })

    test("is atomic: if one item is insufficient, nothing changes", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 0 }, { variantId: variant2, new: 0, used: 0 }])
        const res = await request(app, "/api/inventory-stock-transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchB, items: [
                { variantId: variant1, condition: "new", quantity: 2 },
                { variantId: variant2, condition: "new", quantity: 1 }, // insufficient
            ] },
        })
        expect(res.status).toBe(400)
        const src = await request(app, `/api/inventory/stock?branchId=${branchA}&variantId=${variant1}&condition=new`, { headers: authHeaders })
        expect(src.body.data[0].quantity).toBe(5) // rolled back
    })

    test("records history retrievable per inventory item, with items and attachments", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 4 }])
        const tr = await request(app, "/api/inventory-stock-transfer", {
            method: "POST", headers: authHeaders,
            body: {
                fromBranchId: branchA, toBranchId: branchB, note: "relocation",
                items: [{ variantId: variant1, condition: "used", quantity: 3 }],
            },
        })
        expect(tr.status).toBe(200)
        expect(tr.body.data.transferId).toBeGreaterThan(0)
        expect(typeof tr.body.data.referenceId).toBe("string")

        const history = await request(app, `/api/inventory-stock-transfer?inventoryId=${inventoryId}`, { headers: authHeaders })
        expect(history.status).toBe(200)
        expect(history.body.data.length).toBe(1)
        const doc = history.body.data[0]
        expect(doc.note).toBe("relocation")
        expect(doc.fromBranch.id).toBe(branchA)
        expect(doc.toBranch.id).toBe(branchB)
        expect(doc.items.length).toBe(1)
        expect(doc.items[0].quantity).toBe(3)
        expect(doc.items[0].condition).toBe("used")
        expect(doc.items[0].variant.id).toBe(variant1)
        expect(doc.createdBy).not.toBeNull()
        expect(Array.isArray(doc.attachments)).toBe(true)
    })

    test("history requires inventoryId", async () => {
        const res = await request(app, "/api/inventory-stock-transfer", { headers: authHeaders })
        expect(res.status).toBe(400)
    })

    test("history 404s for a non-existent inventory item", async () => {
        const res = await request(app, "/api/inventory-stock-transfer?inventoryId=999999", { headers: authHeaders })
        expect(res.status).toBe(404)
    })
})
