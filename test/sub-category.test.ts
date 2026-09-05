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

describe("GET /api/sub-category", () => {
    test("requires auth", async () => {
        const res = await request(app, "/api/sub-category")
        expect(res.status).toBe(401)
    })

    test("returns assetCount and inventoryCount, counting only items in this sub-category", async () => {
        const { headers } = await registerAndLogin(app)

        const catRes = await request(app, "/api/category", { method: "POST", headers, body: { name: "Electronics" } })
        const subCatRes = await request(app, "/api/sub-category", { method: "POST", headers, body: { name: "Laptops", categoryId: catRes.body.data.id } })
        const subCategoryId = subCatRes.body.data.id

        await request(app, "/api/asset", { method: "POST", headers, body: { code: "AST-SUB1", name: "Laptop 1", subCategoryId } })
        await request(app, "/api/asset", { method: "POST", headers, body: { code: "AST-SUB2", name: "Laptop 2", subCategoryId } })
        await request(app, "/api/inventory", { method: "POST", headers, body: { name: "Item 1", subCategoryId } })

        // Unrelated sub-category — should not affect the counts above.
        const otherSubCatRes = await request(app, "/api/sub-category", { method: "POST", headers, body: { name: "Monitors", categoryId: catRes.body.data.id } })
        await request(app, "/api/inventory", { method: "POST", headers, body: { name: "Monitor Item", subCategoryId: otherSubCatRes.body.data.id } })

        const { body } = await request(app, "/api/sub-category", { method: "GET", headers })
        const subCategory = body.data.find((sc: any) => sc.id === subCategoryId)
        expect(subCategory).toBeDefined()
        expect(subCategory.assetCount).toBe(2)
        expect(subCategory.inventoryCount).toBe(1)

        const otherSubCategory = body.data.find((sc: any) => sc.id === otherSubCatRes.body.data.id)
        expect(otherSubCategory.assetCount).toBe(0)
        expect(otherSubCategory.inventoryCount).toBe(1)
    })

    test("defaults counts to 0 for a sub-category with no assets or inventory items", async () => {
        const { headers } = await registerAndLogin(app)
        const catRes = await request(app, "/api/category", { method: "POST", headers, body: { name: "Empty Cat" } })
        const subCatRes = await request(app, "/api/sub-category", { method: "POST", headers, body: { name: "Empty SubCat", categoryId: catRes.body.data.id } })

        const { body } = await request(app, "/api/sub-category", { method: "GET", headers })
        const subCategory = body.data.find((sc: any) => sc.id === subCatRes.body.data.id)
        expect(subCategory.assetCount).toBe(0)
        expect(subCategory.inventoryCount).toBe(0)
    })
})
