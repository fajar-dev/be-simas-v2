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
let productId: number
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
    productId = p.body.data.id
    const v1 = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { productId, name: "Cat6 305m", unit: "box" } })
    variant1 = v1.body.data.id
    const v2 = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { productId, name: "Cat5e 100m" } })
    variant2 = v2.body.data.id
})

// helper: set stock for a branch/product
const setStock = (branchId: number, items: { variantId: number; new: number; used: number }[]) =>
    request(app, "/api/inventory/stock/entry", { method: "POST", headers: authHeaders, body: { branchId, productId, items } })

let employeeCounter = 0
const createEmployee = async () => {
    employeeCounter++
    const res = await request(app, "/api/employee", {
        method: "POST", headers: authHeaders,
        body: { name: `Emp ${employeeCounter}`, employeeId: `EMP-${employeeCounter}`, jobPosition: "Staff", email: `emp${employeeCounter}@ex.com`, phone: "0800" },
    })
    return res.body.data.id as number
}

const qtyAt = async (branchId: number, variantId: number, condition: string) => {
    const res = await request(app, `/api/inventory/stock?branchId=${branchId}&variantId=${variantId}&condition=${condition}`, { headers: authHeaders })
    return res.body.data[0]?.quantity ?? 0
}

describe("Inventory API", () => {
    test("auth required", async () => {
        expect((await request(app, "/api/inventory/stock")).status).toBe(401)
        expect((await request(app, "/api/inventory")).status).toBe(401)
    })

    // ── Product & Variant ─────────────────────────────────────────────────────
    test("product delete blocked while it has variants; variant created OK", async () => {
        const del = await request(app, `/api/inventory/${productId}`, { method: "DELETE", headers: authHeaders })
        expect(del.status).toBe(409)

        const list = await request(app, `/api/inventory-variant?productId=${productId}`, { headers: authHeaders })
        expect(list.body.data.length).toBe(2)
    })

    // ── Entry template & nested input ─────────────────────────────────────────
    test("entry-template lists all variants with zero on-hand", async () => {
        const res = await request(app, `/api/inventory/stock/entry-template?branchId=${branchA}&productId=${productId}`, { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(2)
        expect(res.body.data[0]).toMatchObject({ new: 0, used: 0 })
    })

    test("entry sets new/used per variant; monitoring reflects it", async () => {
        const res = await setStock(branchA, [
            { variantId: variant1, new: 10, used: 3 },
            { variantId: variant2, new: 5, used: 0 },
        ])
        expect(res.status).toBe(200)

        const tpl = await request(app, `/api/inventory/stock/entry-template?branchId=${branchA}&productId=${productId}`, { headers: authHeaders })
        const row1 = tpl.body.data.find((r: any) => r.variantId === variant1)
        expect(row1).toMatchObject({ new: 10, used: 3 })

        const mon = await request(app, `/api/inventory/stock?branchId=${branchA}&condition=new`, { headers: authHeaders })
        expect(mon.body.data.every((b: any) => b.condition === "new")).toBe(true)
        expect(mon.body.data.find((b: any) => b.variant.id === variant1).quantity).toBe(10)
    })

    test("entry is a SET (opname): re-saving overwrites the quantity", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 3 }])
        await setStock(branchA, [{ variantId: variant1, new: 4, used: 3 }])
        const mon = await request(app, `/api/inventory/stock?variantId=${variant1}&condition=new`, { headers: authHeaders })
        expect(mon.body.data[0].quantity).toBe(4)
    })

    test("entry rejects a variant that does not belong to the product", async () => {
        const otherProduct = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Other" } })
        const otherVariant = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { productId: otherProduct.body.data.id, name: "X" } })
        const res = await setStock(branchA, [{ variantId: otherVariant.body.data.id, new: 1, used: 0 }])
        expect(res.status).toBe(400)
    })

    // ── Transfer ──────────────────────────────────────────────────────────────
    test("transfer moves only the given condition; source decrements, dest increments", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 4 }])

        const res = await request(app, "/api/inventory/stock/transfer", {
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

    test("transfer rejects when source stock is insufficient (no negative)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 0, used: 2 }])
        const res = await request(app, "/api/inventory/stock/transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchB, items: [{ variantId: variant1, condition: "used", quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        // Source unchanged
        const src = await request(app, `/api/inventory/stock?branchId=${branchA}&variantId=${variant1}&condition=used`, { headers: authHeaders })
        expect(src.body.data[0].quantity).toBe(2)
    })

    test("transfer rejects same source & destination branch", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 0 }])
        const res = await request(app, "/api/inventory/stock/transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchA, items: [{ variantId: variant1, condition: "new", quantity: 1 }] },
        })
        expect(res.status).toBe(400)
    })

    test("transfer is atomic: if one item is insufficient, nothing changes", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 0 }, { variantId: variant2, new: 0, used: 0 }])
        const res = await request(app, "/api/inventory/stock/transfer", {
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

    // ── Assign / Return ─────────────────────────────────────────────────────────
    test("assign reduces branch stock and creates a holding", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()

        const res = await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })
        expect(res.status).toBe(201)

        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // 10 - 4

        const holdings = await request(app, `/api/inventory/stock/holding?employeeId=${employeeId}&active=true`, { headers: authHeaders })
        expect(holdings.body.data.length).toBe(1)
        expect(holdings.body.data[0]).toMatchObject({ quantity: 4, quantityReturned: 0, quantityRemaining: 4, conditionAssigned: "new" })
    })

    test("assign rejects when branch stock is insufficient (no negative)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 2, used: 0 }])
        const employeeId = await createEmployee()
        const res = await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        expect(await qtyAt(branchA, variant1, "new")).toBe(2) // unchanged
    })

    test("return lands in USED even when assigned from NEW; branch used increases", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()
        await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })

        const res = await request(app, "/api/inventory/stock/return", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, quantity: 3 }] },
        })
        expect(res.status).toBe(200)

        expect(await qtyAt(branchA, variant1, "used")).toBe(3) // returned into used
        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // new not credited back

        const holdings = await request(app, `/api/inventory/stock/holding?employeeId=${employeeId}`, { headers: authHeaders })
        expect(holdings.body.data[0]).toMatchObject({ quantity: 4, quantityReturned: 3, quantityRemaining: 1 })
    })

    test("return cannot exceed what the employee holds", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()
        await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 2 }] },
        })
        const res = await request(app, "/api/inventory/stock/return", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        expect(await qtyAt(branchA, variant1, "used")).toBe(0) // nothing returned
    })
})
