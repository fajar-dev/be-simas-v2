import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { Hono } from "hono"
import ExcelJS from "exceljs"
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

describe("Inventory API", () => {
    test("auth required", async () => {
        expect((await request(app, "/api/inventory/stock")).status).toBe(401)
        expect((await request(app, "/api/inventory")).status).toBe(401)
        expect((await request(app, "/api/inventory/export")).status).toBe(401)
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

    test("list returns variantCount and per-condition newCount/usedCount per item", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 7, used: 3 }])
        await setStock(branchB, [{ variantId: variant1, new: 2, used: 0 }])
        const res = await request(app, "/api/inventory", { headers: authHeaders })
        expect(res.status).toBe(200)
        const item = res.body.data.find((i: any) => i.id === inventoryId)
        expect(item.variantCount).toBe(2)  // Cat6 + Cat5e
        expect(item.newCount).toBe(9)      // 7 + 2 on-hand "new"
        expect(item.usedCount).toBe(3)     // 3 on-hand "used"
    })

    test("list can sort by variantCount, newCount, and usedCount", async () => {
        expect((await request(app, "/api/inventory?sortBy=variantCount&order=DESC", { headers: authHeaders })).status).toBe(200)
        expect((await request(app, "/api/inventory?sortBy=newCount&order=ASC", { headers: authHeaders })).status).toBe(200)
        expect((await request(app, "/api/inventory?sortBy=usedCount&order=ASC", { headers: authHeaders })).status).toBe(200)
        expect((await request(app, "/api/inventory?sortBy=category&order=ASC", { headers: authHeaders })).status).toBe(200)
    })

    // ── Advanced filters ─────────────────────────────────────────────────────
    test("list filters by categoryIds and subCategoryIds", async () => {
        const catRes = await request(app, "/api/category", { method: "POST", headers: authHeaders, body: { name: "Office Supplies" } })
        const subRes = await request(app, "/api/sub-category", { method: "POST", headers: authHeaders, body: { name: "Paper", categoryId: catRes.body.data.id } })
        const sub = subRes.body.data
        await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Categorized Item", subCategoryId: sub.id } })

        const byCategory = await request(app, `/api/inventory?categoryIds=${sub.category.id}`, { headers: authHeaders })
        expect(byCategory.status).toBe(200)
        expect(byCategory.body.data.length).toBe(1)
        expect(byCategory.body.data[0].name).toBe("Categorized Item")

        const bySubCategory = await request(app, `/api/inventory?subCategoryIds=${sub.id}`, { headers: authHeaders })
        expect(bySubCategory.body.data.length).toBe(1)
        expect(bySubCategory.body.data[0].name).toBe("Categorized Item")
    })

    test("list filters by units", async () => {
        await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Roll Item", unit: "Roll" } })
        const res = await request(app, "/api/inventory?units=Roll", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.every((i: any) => i.unit === "Roll")).toBe(true)
        expect(res.body.data.some((i: any) => i.name === "Roll Item")).toBe(true)
    })

    test("list filters by isActive", async () => {
        const inactiveRes = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Inactive Item" } })
        await request(app, `/api/inventory/${inactiveRes.body.data.id}`, { method: "PUT", headers: authHeaders, body: { isActive: false } })

        const activeOnly = await request(app, "/api/inventory?isActive=true", { headers: authHeaders })
        expect(activeOnly.body.data.some((i: any) => i.name === "Inactive Item")).toBe(false)

        const inactiveOnly = await request(app, "/api/inventory?isActive=false", { headers: authHeaders })
        expect(inactiveOnly.body.data.some((i: any) => i.name === "Inactive Item")).toBe(true)
    })

    test("list filters by variantStatus", async () => {
        await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "No Variant Item" } })

        const hasVariants = await request(app, "/api/inventory?variantStatus=has_variants", { headers: authHeaders })
        expect(hasVariants.body.data.some((i: any) => i.id === inventoryId)).toBe(true)
        expect(hasVariants.body.data.some((i: any) => i.name === "No Variant Item")).toBe(false)

        const noVariants = await request(app, "/api/inventory?variantStatus=no_variants", { headers: authHeaders })
        expect(noVariants.body.data.some((i: any) => i.id === inventoryId)).toBe(false)
        expect(noVariants.body.data.some((i: any) => i.name === "No Variant Item")).toBe(true)
    })

    test("list filters by newStock/usedStock range", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 7, used: 3 }])

        const inRange = await request(app, "/api/inventory?newStockMin=5&newStockMax=10", { headers: authHeaders })
        expect(inRange.body.data.some((i: any) => i.id === inventoryId)).toBe(true)

        const outOfRange = await request(app, "/api/inventory?newStockMin=100", { headers: authHeaders })
        expect(outOfRange.body.data.some((i: any) => i.id === inventoryId)).toBe(false)

        const usedInRange = await request(app, "/api/inventory?usedStockMin=1&usedStockMax=5", { headers: authHeaders })
        expect(usedInRange.body.data.some((i: any) => i.id === inventoryId)).toBe(true)
    })

    test("list filters by missingFields", async () => {
        await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Full Item", description: "Has a description" } })

        const res = await request(app, "/api/inventory?missingFields=description", { headers: authHeaders })
        expect(res.body.data.some((i: any) => i.id === inventoryId)).toBe(true)  // "UTP Cable" has no description
        expect(res.body.data.some((i: any) => i.name === "Full Item")).toBe(false)
    })

    test("list filters by label key/value", async () => {
        await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Labeled Item", labels: [{ key: "Brand", value: "Belden" }] } })

        const match = await request(app, "/api/inventory?label.Brand=Belden", { headers: authHeaders })
        expect(match.body.data.some((i: any) => i.name === "Labeled Item")).toBe(true)
        expect(match.body.data.some((i: any) => i.id === inventoryId)).toBe(false)

        const noMatch = await request(app, "/api/inventory?label.Brand=Other", { headers: authHeaders })
        expect(noMatch.body.data.some((i: any) => i.name === "Labeled Item")).toBe(false)
    })
})

// ── Export ────────────────────────────────────────────────────────────────────
describe("Inventory Export", () => {
    test("export returns xlsx buffer", async () => {
        const res = await app.request("/api/inventory/export", { method: "GET", headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toContain("spreadsheetml")
    })

    test("export flattens item -> variant -> branch -> condition into one row per leaf", async () => {
        await setStock(branchA, [{ variantId: variant1, new: 5, used: 2 }])

        const res = await app.request("/api/inventory/export", { method: "GET", headers: authHeaders })
        expect(res.status).toBe(200)
        const buffer = Buffer.from(await res.arrayBuffer())

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer as any)
        const sheet = workbook.getWorksheet("Inventory")
        expect(sheet).toBeTruthy()

        const rows: any[][] = []
        sheet!.eachRow((row, rowNumber) => {
            if (rowNumber >= 3) rows.push(row.values as any[])
        })

        // Cat6 305m has "new" & "used" balances in Branch A; Cat5e 100m has no stock at all
        // (its own row, with branch/condition/quantity left blank).
        const hasNewRow = rows.some((r) => r.includes("Cat6 305m") && r.includes("Branch A") && r.includes("New") && r.includes(5))
        const hasUsedRow = rows.some((r) => r.includes("Cat6 305m") && r.includes("Branch A") && r.includes("Used") && r.includes(2))
        const hasNoStockVariantRow = rows.some((r) => r.includes("Cat5e 100m") && !r.includes("Branch A"))

        expect(hasNewRow).toBe(true)
        expect(hasUsedRow).toBe(true)
        expect(hasNoStockVariantRow).toBe(true)
    })

    test("export includes an item with no variants as a single blank-leaf row", async () => {
        await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "No Variant Export Item" } })

        const res = await app.request("/api/inventory/export", { method: "GET", headers: authHeaders })
        expect(res.status).toBe(200)
        const buffer = Buffer.from(await res.arrayBuffer())

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer as any)
        const sheet = workbook.getWorksheet("Inventory")!

        const rows: any[][] = []
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber >= 3) rows.push(row.values as any[])
        })

        expect(rows.some((r) => r.includes("No Variant Export Item"))).toBe(true)
    })

    test("export respects filters, e.g. isActive", async () => {
        const inactiveRes = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Inactive Export Item" } })
        await request(app, `/api/inventory/${inactiveRes.body.data.id}`, { method: "PUT", headers: authHeaders, body: { isActive: false } })

        const res = await app.request("/api/inventory/export?isActive=true", { method: "GET", headers: authHeaders })
        expect(res.status).toBe(200)
        const buffer = Buffer.from(await res.arrayBuffer())

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer as any)
        const sheet = workbook.getWorksheet("Inventory")!

        const rows: any[][] = []
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber >= 3) rows.push(row.values as any[])
        })

        expect(rows.some((r) => r.includes("Inactive Export Item"))).toBe(false)
    })
})
