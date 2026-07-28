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

// ── Mock MinIO to prevent real connections (inventory item images) ─────────
mock.module("../src/core/helpers/minio", () => {
    const helper = {
        upload: async () => "attachments/test-file.txt",
        getProxyUrl: (name: string) => `http://cdn.test.com/${name}`,
        getPresignedUrl: async (name: string) => `http://cdn.test.com/${name}`,
        delete: async () => {},
        ensureBucket: async () => {},
    }
    return { minio: helper, default: helper }
})

let app: Hono

beforeAll(async () => {
    await initTestDatabase()
    app = createTestApp()
})

afterAll(async () => {
    await destroyTestDatabase()
})

beforeEach(async () => {
    await cleanTestDatabase()
})

describe("GET /api/category", () => {
    test("requires auth", async () => {
        const res = await request(app, "/api/category")
        expect(res.status).toBe(401)
    })

    test("returns assetCount and inventoryCount, counting only items in this category's sub-categories", async () => {
        const { headers } = await registerAndLogin(app)

        const catRes = await request(app, "/api/category", { method: "POST", headers, body: { name: "Electronics" } })
        const categoryId = catRes.body.data.id
        const subCatRes = await request(app, "/api/sub-category", { method: "POST", headers, body: { name: "Laptops", categoryId } })
        const subCategoryId = subCatRes.body.data.id

        await request(app, "/api/asset", { method: "POST", headers, body: { code: "AST-CAT1", name: "Laptop 1", subCategoryId } })
        await request(app, "/api/inventory", { method: "POST", headers, body: { name: "Item 1", subCategoryId } })
        await request(app, "/api/inventory", { method: "POST", headers, body: { name: "Item 2", subCategoryId } })

        // Unrelated category — should not affect the counts above.
        const otherCatRes = await request(app, "/api/category", { method: "POST", headers, body: { name: "Furniture" } })
        const otherSubCatRes = await request(app, "/api/sub-category", { method: "POST", headers, body: { name: "Chairs", categoryId: otherCatRes.body.data.id } })
        await request(app, "/api/inventory", { method: "POST", headers, body: { name: "Chair Item", subCategoryId: otherSubCatRes.body.data.id } })

        const { body } = await request(app, "/api/category", { method: "GET", headers })
        const category = body.data.find((c: any) => c.id === categoryId)
        expect(category).toBeDefined()
        expect(category.assetCount).toBe(1)
        expect(category.inventoryCount).toBe(2)

        const otherCategory = body.data.find((c: any) => c.id === otherCatRes.body.data.id)
        expect(otherCategory.inventoryCount).toBe(1)
    })

    test("defaults counts to 0 for a category with no sub-categories", async () => {
        const { headers } = await registerAndLogin(app)
        const catRes = await request(app, "/api/category", { method: "POST", headers, body: { name: "Empty Category" } })

        const { body } = await request(app, "/api/category", { method: "GET", headers })
        const category = body.data.find((c: any) => c.id === catRes.body.data.id)
        expect(category.assetCount).toBe(0)
        expect(category.inventoryCount).toBe(0)
    })
})
