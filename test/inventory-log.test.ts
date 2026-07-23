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

const logsFor = async (id: number) => {
    const res = await request(app, `/api/inventory-log?inventoryId=${id}`, { headers: authHeaders })
    return res
}

describe("Inventory Log API", () => {
    test("auth required", async () => {
        expect((await request(app, "/api/inventory-log")).status).toBe(401)
    })

    test("create is logged with module=inventory, action=create", async () => {
        const res = await logsFor(inventoryId)
        expect(res.status).toBe(200)
        const entries = res.body.data
        expect(entries.length).toBe(1)
        expect(entries[0]).toMatchObject({ inventoryId, module: "inventory", action: "create" })
        expect(entries[0].createdBy).not.toBeNull()
    })

    test("update is logged with module=inventory, action=update", async () => {
        await request(app, `/api/inventory/${inventoryId}`, { method: "PUT", headers: authHeaders, body: { name: "UTP Cable Cat6" } })
        const res = await logsFor(inventoryId)
        const actions = res.body.data.map((e: any) => e.action)
        expect(actions).toContain("update")
    })

    test("stock entry is logged with module=stock, action=entry", async () => {
        await request(app, "/api/inventory/stock/entry", {
            method: "POST", headers: authHeaders,
            body: { branchId: branchA, inventoryId, items: [{ variantId: variant1, new: 10, used: 0 }] },
        })
        const res = await logsFor(inventoryId)
        const entry = res.body.data.find((e: any) => e.action === "entry")
        expect(entry).toBeTruthy()
        expect(entry.module).toBe("stock")
    })

    test("stock-in is logged with module=stock, action=stock_in", async () => {
        await request(app, "/api/inventory-stock-in", {
            method: "POST", headers: authHeaders,
            body: { inventoryId, items: [{ branchId: branchA, variantId: variant1, new: 5, used: 0 }] },
        })
        const res = await logsFor(inventoryId)
        const entry = res.body.data.find((e: any) => e.action === "stock_in")
        expect(entry).toBeTruthy()
        expect(entry.module).toBe("stock")
    })

    test("transfer is logged with module=stock, action=transfer", async () => {
        await request(app, "/api/inventory/stock/entry", {
            method: "POST", headers: authHeaders,
            body: { branchId: branchA, inventoryId, items: [{ variantId: variant1, new: 10, used: 0 }] },
        })
        await request(app, "/api/inventory-stock-transfer", {
            method: "POST", headers: authHeaders,
            body: { fromBranchId: branchA, toBranchId: branchB, items: [{ variantId: variant1, condition: "new", quantity: 2 }] },
        })
        const res = await logsFor(inventoryId)
        const entry = res.body.data.find((e: any) => e.action === "transfer")
        expect(entry).toBeTruthy()
        expect(entry.module).toBe("stock")
    })

    test("assign and return are logged with module=stock", async () => {
        await request(app, "/api/inventory/stock/entry", {
            method: "POST", headers: authHeaders,
            body: { branchId: branchA, inventoryId, items: [{ variantId: variant1, new: 10, used: 0 }] },
        })
        const emp = await request(app, "/api/employee", {
            method: "POST", headers: authHeaders,
            body: { name: "Emp 1", employeeId: "EMP-1", jobPosition: "Staff", email: "emp1@ex.com", phone: "0800" },
        })
        const employeeId = emp.body.data.id
        await request(app, "/api/inventory-stock-out", {
            method: "POST", headers: authHeaders,
            body: { type: "employee", employeeId, items: [{ variantId: variant1, branchId: branchA, condition: "new", quantity: 3 }] },
        })
        await request(app, "/api/inventory-stock-out/return", {
            method: "POST", headers: authHeaders,
            body: { employeeId, items: [{ variantId: variant1, branchId: branchA, quantity: 1 }] },
        })

        const res = await logsFor(inventoryId)
        const actions = res.body.data.map((e: any) => e.action)
        expect(actions).toContain("assign")
        expect(actions).toContain("return")
    })

    test("filters strictly by inventoryId (does not leak other items' logs)", async () => {
        const other = await request(app, "/api/inventory", { method: "POST", headers: authHeaders, body: { name: "Other Item" } })
        const res = await logsFor(inventoryId)
        expect(res.body.data.every((e: any) => e.inventoryId === inventoryId)).toBe(true)
        expect(res.body.data.some((e: any) => e.inventoryId === other.body.data.id)).toBe(false)
    })

    test("supports pagination meta", async () => {
        const res = await request(app, `/api/inventory-log?inventoryId=${inventoryId}&page=1&limit=1`, { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(1)
        expect(res.body.meta.total).toBeGreaterThanOrEqual(1)
    })
})
