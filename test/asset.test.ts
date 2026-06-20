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
import { resetCounters } from "./helpers"

// ── Mock MinIO to prevent real connections ──────────────────────────────────

mock.module("../src/core/helpers/minio", () => {
    const sanitizePath = (urlOrPath: string | null | undefined, bucket: string = "stock"): string | null => {
        if (!urlOrPath) return null
        let decoded = urlOrPath
        try {
            while (decoded && decoded.includes('%')) {
                const next = decodeURIComponent(decoded)
                if (next === decoded) break
                decoded = next
            }
        } catch { /* ignore */ }
        const marker = `/${bucket}/`
        if (decoded.includes(marker)) {
            const parts = decoded.split(marker)
            decoded = parts[parts.length - 1]
        }
        if (decoded.includes('?')) decoded = decoded.split('?')[0]
        decoded = decoded.replace(/^\/+|\/+$/g, '')
        return decoded || null
    }

    const helper = {
        upload: async () => {},
        getProxyUrl: (objectName: string) => `http://cdn.test.com/stock/${objectName}`,
        getPresignedUrl: async (path: string) => `http://cdn.test.com/stock/${path}`,
        getPublicUrl: (objectName: string) => `http://cdn.test.com/stock/${objectName}`,
        sanitizePath,
        ensureBucket: async () => {},
        proxyHandler: async () => new Response("ok"),
    }

    return { minio: helper, default: helper }
})

// ── Setup ───────────────────────────────────────────────────────────────────

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
    resetCounters()
})

// ── Test Data Helper ────────────────────────────────────────────────────────

let assetCounter = 0

function createAssetData(subCategoryId: number, overrides: Record<string, any> = {}) {
    assetCounter++
    return {
        code: `AST-${String(assetCounter).padStart(3, "0")}`,
        name: `Asset ${assetCounter}`,
        description: `Description for asset ${assetCounter}`,
        price: 15000000 + assetCounter,
        purchaseDate: "2026-06-18",
        brand: "Brand A",
        model: "Model X",
        image: "assets/image-123.jpg",
        subCategoryId,
        ...overrides,
    }
}

async function createTestSubCategory(app: Hono, headers: any) {
    // 1. Create Category
    const catRes = await request(app, "/api/category", {
        method: "POST",
        headers,
        body: { name: "Electronics", description: "Electronics items" }
    })
    const category = catRes.body.data

    // 2. Create SubCategory
    const subRes = await request(app, "/api/sub-category", {
        method: "POST",
        headers,
        body: { name: "Laptops", categoryId: category.id, description: "Laptops sub category" }
    })
    return subRes.body.data
}

// Reset asset counter in beforeEach
beforeEach(() => {
    assetCounter = 0
})

// ═══════════════════════════════════════════════════════════════════════════
// Authentication Required — All asset routes need auth
// ═══════════════════════════════════════════════════════════════════════════

describe("Asset - Auth Required", () => {
    test("GET /api/asset should fail without auth", async () => {
        const { status, body } = await request(app, "/api/asset")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("POST /api/asset should fail without auth", async () => {
        const { status, body } = await request(app, "/api/asset", {
            method: "POST",
            body: { name: "Asset", code: "AST-001", subCategoryId: 1 },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("GET /api/asset/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/asset/1")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("PUT /api/asset/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/asset/1", {
            method: "PUT",
            body: { name: "Updated" },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("DELETE /api/asset/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/asset/1", {
            method: "DELETE",
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/asset — Create
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/asset", () => {
    test("should create an asset successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)
        const assetData = createAssetData(subCategory.id)

        const { status, body } = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: assetData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Asset created successfully")
        expect(body.data).toBeDefined()
        expect(body.data.code).toBe(assetData.code)
        expect(body.data.name).toBe(assetData.name)
        expect(body.data.description).toBe(assetData.description)
        expect(body.data.price).toBe(assetData.price)
        expect(body.data.purchaseDate).toBe(assetData.purchaseDate)
        expect(body.data.brand).toBe(assetData.brand)
        expect(body.data.model).toBe(assetData.model)
        expect(body.data.image).toBe(`http://cdn.test.com/stock/${assetData.image}`)
        expect(body.data.subCategory).toBeDefined()
        expect(body.data.subCategory).toBeDefined()
        expect(body.data.subCategory.id).toBe(subCategory.id)
        expect(body.data.subCategory.name).toBe(subCategory.name)
        expect(body.data.subCategory.category).toBeDefined()
        expect(body.data.createdBy).toBeDefined()
        expect(body.data.createdBy.name).toBe("Test User")
    })

    test("should create an asset without optional fields", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        const { status, body } = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: {
                code: "AST-MIN",
                name: "Minimal Asset",
                subCategoryId: subCategory.id
            },
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.description).toBeNull()
        expect(body.data.price).toBeNull()
        expect(body.data.purchaseDate).toBeNull()
        expect(body.data.brand).toBeNull()
        expect(body.data.model).toBeNull()
        expect(body.data.image).toBeNull()
        expect(body.data.createdBy).toBeDefined()
        expect(body.data.createdBy.name).toBe("Test User")
    })

    test("should fail validation without code", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        const { status, body } = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: { name: "Asset Test", subCategoryId: subCategory.id },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation without subCategoryId", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: { code: "AST-001", name: "Asset Test" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should enforce unique code", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)
        const assetData = createAssetData(subCategory.id, { code: "UNIQUE-CODE" })

        // Create first time
        await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: assetData,
        })

        // Create second time with same code
        const { status, body } = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id, { code: "UNIQUE-CODE" }),
        })

        expect(status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Asset code must be unique")
    })

    test("should create an asset with immediate assignment and relocation successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        // 1. Create Employee
        const empRes = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: {
                employeeId: "EMP-IMMEDIATE",
                name: "Immediate Employee",
                jobPosition: "Developer",
                email: "immediate@example.com",
                phone: "08123456789"
            }
        })
        const employeeId = empRes.body.data.id

        // 2. Create Branch & Location
        const branchRes = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-IMMEDIATE", name: "Immediate Branch", description: "Immediate Branch Desc" },
        })
        const locRes = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: { name: "Immediate Room", description: "Immediate Room Desc", branchId: branchRes.body.data.id },
        })
        const locationId = locRes.body.data.id

        // 3. Create Asset with immediate assignment & relocation
        const assetData = createAssetData(subCategory.id, {
            code: "IMMEDIATE-AST",
            employeeId,
            assignedDate: "2026-06-20 07:23:00",
            assignNote: "Immediate Assign Note",
            locationId,
            locationDate: "2026-06-20 07:24:00",
            locationNote: "Immediate Relocate Note",
        })

        const { status, body } = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: assetData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.activeHolder).toBeDefined()
        expect(body.data.activeHolder.employee.name).toBe("Immediate Employee")
        expect(body.data.lastLocation).toBeDefined()
        expect(body.data.lastLocation.location.name).toBe("Immediate Room")
        expect(body.data.lastLocation.location.branch.name).toBe("Immediate Branch")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/asset — List
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/asset", () => {
    test("should return empty list initially", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/asset", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.length).toBe(0)
        expect(body.meta.total).toBe(0)
    })

    test("should return created assets", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id, {
                labels: [
                    { key: "Color", value: "Space Gray" },
                    { key: "Storage", value: "512GB" }
                ]
            }),
        })

        const { status, body } = await request(app, "/api/asset", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBe(1)
        expect(body.meta.total).toBe(1)
        expect(body.data[0].subCategory.id).toBe(subCategory.id)
        expect(body.data[0].labels).toBeDefined()
        expect(body.data[0].labels.length).toBe(2)
        expect(body.data[0].labels[0].key).toBe("Color")
        expect(body.data[0].labels[0].value).toBe("Space Gray")
        expect(body.data[0].labels[1].key).toBe("Storage")
        expect(body.data[0].labels[1].value).toBe("512GB")
    })

    test("should search assets by name or code", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id, { name: "MacBook Pro", code: "MAC-01" }),
        })
        await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id, { name: "Dell XPS", code: "DELL-01" }),
        })

        // Search by name
        const res1 = await request(app, "/api/asset?q=MacBook", { method: "GET", headers })
        expect(res1.body.data.length).toBe(1)
        expect(res1.body.data[0].name).toBe("MacBook Pro")

        // Search by code
        const res2 = await request(app, "/api/asset?q=DELL-01", { method: "GET", headers })
        expect(res2.body.data.length).toBe(1)
        expect(res2.body.data[0].code).toBe("MAC-01" ? "DELL-01" : "DELL-01") // check code
        expect(res2.body.data[0].name).toBe("Dell XPS")
    })

    test("should sort assets by name or price", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id, { name: "B Asset", price: 20000, code: "AST-B" }),
        })
        await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id, { name: "A Asset", price: 30000, code: "AST-A" }),
        })
        await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id, { name: "C Asset", price: 10000, code: "AST-C" }),
        })

        // Sort by name ASC
        const resNameAsc = await request(app, "/api/asset?sortBy=name&order=ASC", { method: "GET", headers })
        expect(resNameAsc.status).toBe(200)
        expect(resNameAsc.body.data[0].name).toBe("A Asset")
        expect(resNameAsc.body.data[1].name).toBe("B Asset")
        expect(resNameAsc.body.data[2].name).toBe("C Asset")

        // Sort by name DESC
        const resNameDesc = await request(app, "/api/asset?sortBy=name&order=DESC", { method: "GET", headers })
        expect(resNameDesc.status).toBe(200)
        expect(resNameDesc.body.data[0].name).toBe("C Asset")
        expect(resNameDesc.body.data[1].name).toBe("B Asset")
        expect(resNameDesc.body.data[2].name).toBe("A Asset")

        // Sort by price ASC
        const resPriceAsc = await request(app, "/api/asset?sortBy=price&order=ASC", { method: "GET", headers })
        expect(resPriceAsc.status).toBe(200)
        expect(resPriceAsc.body.data[0].price).toBe(10000)
        expect(resPriceAsc.body.data[1].price).toBe(20000)
        expect(resPriceAsc.body.data[2].price).toBe(30000)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/asset/:id — Show
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/asset/:id", () => {
    test("should return asset by ID", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)
        const assetData = createAssetData(subCategory.id)

        const createRes = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: assetData,
        })
        const assetId = createRes.body.data.id

        const { status, body } = await request(app, `/api/asset/${assetId}`, {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.id).toBe(assetId)
        expect(body.data.code).toBe(assetData.code)
    })

    test("should return 404 for non-existent asset", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/asset/99999", {
            method: "GET",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Asset not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/asset/:id — Update
// ═══════════════════════════════════════════════════════════════════════════

describe("PUT /api/asset/:id", () => {
    test("should update asset details successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        const createRes = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id),
        })
        const assetId = createRes.body.data.id

        const { status, body } = await request(app, `/api/asset/${assetId}`, {
            method: "PUT",
            headers,
            body: { name: "Updated Asset Name", price: 18000000 },
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.name).toBe("Updated Asset Name")
        expect(body.data.price).toBe(18000000)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/asset/:id — Destroy
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /api/asset/:id", () => {
    test("should delete asset successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)

        const createRes = await request(app, "/api/asset", {
            method: "POST",
            headers,
            body: createAssetData(subCategory.id),
        })
        const assetId = createRes.body.data.id

        const { status, body } = await request(app, `/api/asset/${assetId}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)

        // Verify it's deleted
        const { status: getStatus } = await request(app, `/api/asset/${assetId}`, {
            method: "GET",
            headers,
        })
        expect(getStatus).toBe(404)
    })
})
