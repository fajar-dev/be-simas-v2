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

// helper: set stock for a branch/inventory item
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

describe("Inventory API", () => {
    test("auth required", async () => {
        expect((await request(app, "/api/inventory/stock")).status).toBe(401)
        expect((await request(app, "/api/inventory")).status).toBe(401)
    })

    // ── Inventory item & Variant ─────────────────────────────────────────────────────
    test("inventory item delete blocked while it has variants; variant created OK", async () => {
        const del = await request(app, `/api/inventory/${inventoryId}`, { method: "DELETE", headers: authHeaders })
        expect(del.status).toBe(409)

        const list = await request(app, `/api/inventory-variant?inventoryId=${inventoryId}`, { headers: authHeaders })
        expect(list.body.data.length).toBe(2)
    })

    test("variant stores image & description and returns them", async () => {
        const res = await request(app, "/api/inventory-variant", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, name: "With media", code: "WM-1", image: "inventory/v.png", description: "Fiber single-mode" },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.description).toBe("Fiber single-mode")
        expect(typeof res.body.data.image).toBe("string") // resolved URL

        const upd = await request(app, `/api/inventory-variant/${res.body.data.id}`, {
            method: "PUT", headers: authHeaders,
            body: { description: "Updated desc" },
        })
        expect(upd.status).toBe(200)
        expect(upd.body.data.description).toBe("Updated desc")
    })

    test("code auto-fills from id when empty (item & variant), like category", async () => {
        const item = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "No Code Item" } })
        expect(item.status).toBe(201)
        expect(item.body.data.code).toBe(String(item.body.data.id))

        const v = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { inventoryId: item.body.data.id, name: "No Code Variant" } })
        expect(v.status).toBe(201)
        expect(v.body.data.code).toBe(String(v.body.data.id))

        // Explicit code is preserved.
        const withCode = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Coded", code: "INV-XYZ" } })
        expect(withCode.body.data.code).toBe("INV-XYZ")
    })

    // ── Entry template & nested input ─────────────────────────────────────────
    test("entry-template lists all variants with zero on-hand", async () => {
        const res = await request(app, `/api/inventory/stock/entry-template?branchId=${branchA}&inventoryId=${inventoryId}`, { headers: authHeaders })
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

        const tpl = await request(app, `/api/inventory/stock/entry-template?branchId=${branchA}&inventoryId=${inventoryId}`, { headers: authHeaders })
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

    test("entry rejects a variant that does not belong to the inventory item", async () => {
        const otherItem = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Other" } })
        const otherVariant = await request(app, "/api/inventory-variant", { method: "POST", headers: authHeaders, body: { inventoryId: otherItem.body.data.id, name: "X" } })
        const res = await setStock(branchA, [{ variantId: otherVariant.body.data.id, new: 1, used: 0 }])
        expect(res.status).toBe(400)
    })

    // ── Assign / Return ─────────────────────────────────────────────────────────
    test("assign to employee reduces branch stock and creates a returnable stock-out", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()

        const res = await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })
        expect(res.status).toBe(201)

        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // 10 - 4

        const stockOuts = await request(app, `/api/inventory/stock/out?employeeId=${employeeId}&active=true`, { headers: authHeaders })
        expect(stockOuts.body.data.length).toBe(1)
        expect(stockOuts.body.data[0]).toMatchObject({ type: "employee", quantity: 4, quantityReturned: 0, quantityRemaining: 4, conditionAssigned: "new" })
    })

    test("assign rejects when branch stock is insufficient (no negative)", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 2, used: 0 }])
        const employeeId = await createEmployee()
        const res = await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        expect(await qtyAt(branchA, variant1, "new")).toBe(2) // unchanged
    })

    test("assign rejects employeeId when type is employee but missing, or when type is other but provided", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()

        const missing = await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 1 }] },
        })
        expect(missing.status).toBe(422)

        const extra = await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { type: "other", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 1 }] },
        })
        expect(extra.status).toBe(422)
    })

    test("assign with type other reduces branch stock and creates a one-way, already-resolved stock-out", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])

        const res = await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { type: "other", note: "Consumed for cabling job", items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })
        expect(res.status).toBe(201)
        expect(res.body.data[0]).toMatchObject({ type: "other", quantity: 4, quantityReturned: 4, quantityRemaining: 0 })
        expect(res.body.data[0].employee).toBeNull()
        expect(res.body.data[0].returnedDate).toBeTruthy()

        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // 10 - 4

        // "Other"-type rows always surface under active=true (never stale) despite quantityRemaining being 0.
        const stockOuts = await request(app, `/api/inventory/stock/out?branchId=${branchA}&active=true`, { headers: authHeaders })
        expect(stockOuts.body.data.some((s: any) => s.type === "other" && s.quantity === 4)).toBe(true)
    })

    test("return lands in USED even when assigned from NEW; branch used increases", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()
        await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 4 }] },
        })

        const res = await request(app, "/api/inventory/stock/return", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, quantity: 3 }] },
        })
        expect(res.status).toBe(200)

        expect(await qtyAt(branchA, variant1, "used")).toBe(3) // returned into used
        expect(await qtyAt(branchA, variant1, "new")).toBe(6) // new not credited back

        const stockOuts = await request(app, `/api/inventory/stock/out?employeeId=${employeeId}`, { headers: authHeaders })
        expect(stockOuts.body.data[0]).toMatchObject({ quantity: 4, quantityReturned: 3, quantityRemaining: 1 })
    })

    test("return cannot exceed what the employee holds", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 10, used: 0 }])
        const employeeId = await createEmployee()
        await request(app, "/api/inventory/stock/assign", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 2 }] },
        })
        const res = await request(app, "/api/inventory/stock/return", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, quantity: 5 }] },
        })
        expect(res.status).toBe(400)
        expect(await qtyAt(branchA, variant1, "used")).toBe(0) // nothing returned
    })

    // ── Rich create (unit, labels, variants + initial stock) ──────────────────
    test("create item with unit, labels, variants + initial stock (atomic)", async () => {
        const res = await request(app, "/api/inventory", {
            method: "POST", headers: authHeaders,
            body: {
                name: "Kabel Fiber", unit: "Roll",
                labels: [{ key: "Brand", value: "Belden" }, { key: "Warna", value: "Kuning" }],
                variants: [
                    { name: "SM 305m", image: "inventory/sm.png", description: "Single-mode", initialStock: [{ branchId: branchA, new: 10, used: 2 }] },
                    { name: "MM 100m" },
                ],
            },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.unit).toBe("Roll")
        expect(res.body.data.labels.length).toBe(2)
        expect(res.body.data.createdBy).toBeTruthy() // created-by is serialized
        expect(Array.isArray(res.body.data.attachments)).toBe(true)
        const id = res.body.data.id

        // Both variants created
        const variants = await request(app, `/api/inventory-variant?inventoryId=${id}`, { headers: authHeaders })
        expect(variants.body.data.length).toBe(2)
        const sm = variants.body.data.find((v: any) => v.name === "SM 305m")
        expect(sm.description).toBe("Single-mode")
        expect(typeof sm.image).toBe("string") // resolved URL

        // Initial stock became a balance; unit is sourced from the item.
        const bal = await request(app, `/api/inventory/stock?inventoryId=${id}&condition=new`, { headers: authHeaders })
        const row = bal.body.data.find((b: any) => b.variant.id === sm.id)
        expect(row.quantity).toBe(10)
        expect(row.variant.unit).toBe("Roll")
    })

    test("label-keys returns distinct label keys", async () => {
        await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "A", labels: [{ key: "Brand", value: "X" }, { key: "Color", value: "Red" }] } })
        const res = await request(app, "/api/inventory/label-keys", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual(expect.arrayContaining(["Brand", "Color"]))
    })

    test("list returns variantCount and total balanceCount per item", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 7, used: 3 }])
        await setStock(branchB, [{ variantId: variant1, new: 2, used: 0 }])
        const res = await request(app, "/api/inventory", { headers: authHeaders })
        expect(res.status).toBe(200)
        const item = res.body.data.find((i: any) => i.id === inventoryId)
        expect(item.variantCount).toBe(2)   // Cat6 + Cat5e
        expect(item.balanceCount).toBe(12)  // 7 + 3 + 2 on-hand
    })

    test("list can sort by variantCount and balanceCount", async () => {
        expect((await request(app, "/api/inventory?sortBy=variantCount&order=DESC", { headers: authHeaders })).status).toBe(200)
        expect((await request(app, "/api/inventory?sortBy=balanceCount&order=ASC", { headers: authHeaders })).status).toBe(200)
        expect((await request(app, "/api/inventory?sortBy=category&order=ASC", { headers: authHeaders })).status).toBe(200)
    })
})
