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

    const p = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "UTP Cable" } })
    inventoryId = p.body.data.id
    const v1 = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { inventoryId, name: "Cat6 305m", unit: "box" } })
    variant1 = v1.body.data.id
})

const setStock = (branchId: number, items: { variantId: number; new: number; used: number }[]) =>
    request(app, "/api/inventory/stock/entry", { method: "POST", headers: authHeaders, body: { branchId, inventoryId, items } })

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

describe("Inventory Stock Out API", () => {
    test("auth required", async () => {
        expect((await request(app, "/api/inventory-stock-out")).status).toBe(401)
        expect((await request(app, "/api/inventory-stock-out", { method: "POST", body: {} })).status).toBe(401)
    })

    test("assign to employee reduces branch stock and creates a returnable stock-out", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()

        const res = await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })
        expect(res.status).toBe(201)

        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // 10 - 4

        const stockOuts = await request(app, `/api/inventory-stock-out?employeeId=${employeeId}&active=true`, { headers: authHeaders })
        expect(stockOuts.body.data.length).toBe(1)
        expect(stockOuts.body.data[0]).toMatchObject({ type: "employee", quantity: 4, quantityReturned: 0, quantityRemaining: 4, conditionAssigned: "new" })
    })

    test("assign rejects when branch stock is insufficient (no negative)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 2, used: 0 }])
        const employeeId = await createEmployee()
        const res = await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        expect(await qtyAt(branchA, variant1, "new")).toBe(2) // unchanged
    })

    test("assign rejects employeeId when type is employee but missing, or when type is other but provided", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()

        const missing = await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 1 }] },
        })
        expect(missing.status).toBe(422)

        const extra = await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "other", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 1 }] },
        })
        expect(extra.status).toBe(422)
    })

    test("assign with type other reduces branch stock and creates a one-way, already-resolved stock-out", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])

        const res = await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "other", note: "Consumed for cabling job", items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })
        expect(res.status).toBe(201)
        expect(res.body.data[0]).toMatchObject({ type: "other", quantity: 4, quantityReturned: 4, quantityRemaining: 0 })
        expect(res.body.data[0].employee).toBeNull()
        expect(res.body.data[0].returnedDate).toBeTruthy()

        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // 10 - 4

        // "Other"-type rows always surface under active=true (never stale) despite quantityRemaining being 0.
        const stockOuts = await request(app, `/api/inventory-stock-out?branchId=${branchA}&active=true`, { headers: authHeaders })
        expect(stockOuts.body.data.some((s: any) => s.type === "other" && s.quantity === 4)).toBe(true)
    })

    test("return lands in USED even when assigned from NEW; branch used increases", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()
        await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })

        const res = await request(app, "/api/inventory-stock-out/return", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, quantity: 3 }] },
        })
        expect(res.status).toBe(200)

        expect(await qtyAt(branchA, variant1, "used")).toBe(3) // returned into used
        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // new not credited back

        const stockOuts = await request(app, `/api/inventory-stock-out?employeeId=${employeeId}`, { headers: authHeaders })
        expect(stockOuts.body.data[0]).toMatchObject({ quantity: 4, quantityReturned: 3, quantityRemaining: 1 })
    })

    test("return cannot exceed what the employee holds", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()
        await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 2 }] },
        })
        const res = await request(app, "/api/inventory-stock-out/return", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        expect(await qtyAt(branchA, variant1, "used")).toBe(0) // nothing returned
    })
})
