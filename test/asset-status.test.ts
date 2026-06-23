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

// ── Test Data Helpers ───────────────────────────────────────────────────────

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
    const catRes = await request(app, "/api/category", {
        method: "POST",
        headers,
        body: { name: "Electronics", description: "Electronics items" }
    })
    const category = catRes.body.data

    const subRes = await request(app, "/api/sub-category", {
        method: "POST",
        headers,
        body: { name: "Laptops", categoryId: category.id, description: "Laptops sub category" }
    })
    return subRes.body.data
}

async function createTestAsset(app: Hono, headers: any, subCategoryId: number, overrides: Record<string, any> = {}) {
    const res = await request(app, "/api/asset", {
        method: "POST",
        headers,
        body: createAssetData(subCategoryId, overrides),
    })
    return res.body.data
}

beforeEach(() => {
    assetCounter = 0
})

// ═══════════════════════════════════════════════════════════════════════════
// Bulk Asset Status — Auth Required
// ═══════════════════════════════════════════════════════════════════════════

describe("Bulk Asset Status - Auth Required", () => {
    test("POST /api/asset-status/bulk should fail without auth", async () => {
        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            body: { assetIds: [1], status: "active" },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// Bulk Asset Status — Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("Bulk Asset Status - Validation", () => {
    test("should fail with empty assetIds array", async () => {
        const { headers } = await registerAndLogin(app)
        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: { assetIds: [], status: "active" },
        })
        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail without assetIds field", async () => {
        const { headers } = await registerAndLogin(app)
        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: { status: "active" },
        })
        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail without status field", async () => {
        const { headers } = await registerAndLogin(app)
        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: { assetIds: [1] },
        })
        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail with invalid status value", async () => {
        const { headers } = await registerAndLogin(app)
        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: { assetIds: [1], status: "invalid_status" },
        })
        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// Bulk Asset Status — Success Cases
// ═══════════════════════════════════════════════════════════════════════════

describe("Bulk Asset Status - Success", () => {
    test("should bulk update status for multiple assets", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)
        const asset1 = await createTestAsset(app, headers, subCategory.id)
        const asset2 = await createTestAsset(app, headers, subCategory.id)
        const asset3 = await createTestAsset(app, headers, subCategory.id)

        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: {
                assetIds: [asset1.id, asset2.id, asset3.id],
                status: "under_repair",
                note: "Bulk maintenance",
            },
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.count).toBe(3)
    })

    test("should bulk update status for a single asset", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)
        const asset = await createTestAsset(app, headers, subCategory.id)

        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: {
                assetIds: [asset.id],
                status: "idle",
            },
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.count).toBe(1)
    })

    test("should bulk update status with optional note as null", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)
        const asset = await createTestAsset(app, headers, subCategory.id)

        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: {
                assetIds: [asset.id],
                status: "damaged",
                note: null,
            },
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.count).toBe(1)
    })

    test("should create status records visible in status history", async () => {
        const { headers } = await registerAndLogin(app)
        const subCategory = await createTestSubCategory(app, headers)
        const asset = await createTestAsset(app, headers, subCategory.id)

        // Bulk update status
        await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: {
                assetIds: [asset.id],
                status: "sold",
                note: "Asset sold",
            },
        })

        // Check status history
        const { status, body } = await request(app, `/api/asset-status?assetId=${asset.id}`, {
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        // Should have at least the status we just created (plus initial status from asset creation if applicable)
        const statusRecords = body.data
        const soldRecord = statusRecords.find((r: any) => r.status === "sold")
        expect(soldRecord).toBeDefined()
        expect(soldRecord.note).toBe("Asset sold")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// Bulk Asset Status — Error Cases
// ═══════════════════════════════════════════════════════════════════════════

describe("Bulk Asset Status - Error Cases", () => {
    test("should fail when asset ID does not exist", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/asset-status/bulk", {
            method: "POST",
            headers,
            body: {
                assetIds: [99999],
                status: "active",
            },
        })

        expect(status).not.toBe(201)
        expect(body.success).toBe(false)
    })
})
