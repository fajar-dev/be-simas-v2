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

// ═══════════════════════════════════════════════════════════════════════════
// Authentication Required — All statistic routes need auth
// ═══════════════════════════════════════════════════════════════════════════

describe("Statistic - Auth Required", () => {
    const endpoints = [
        "/api/statistic/summary",
        "/api/statistic/assets-by-category",
        "/api/statistic/assets-by-location",
        "/api/statistic/assets-by-sub-category",
        "/api/statistic/asset-aging",
        "/api/statistic/data-quality",
        "/api/statistic/depreciation",
    ]

    for (const endpoint of endpoints) {
        test(`GET ${endpoint} should fail without auth`, async () => {
            const { status, body } = await request(app, endpoint)
            expect(status).toBe(401)
            expect(body.success).toBe(false)
        })
    }
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/statistic/summary
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/statistic/summary", () => {
    test("should return summary data with correct shape", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/summary", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Statistics retrieved successfully")
        expect(body.data).toBeDefined()

        // Verify all expected fields exist
        expect(typeof body.data.totalAssets).toBe("number")
        expect(typeof body.data.totalPrice).toBe("number")
        expect(typeof body.data.totalBookValue).toBe("number")
        expect(typeof body.data.totalDepreciation).toBe("number")
        expect(typeof body.data.totalCategories).toBe("number")
        expect(typeof body.data.totalSubCategories).toBe("number")
        expect(typeof body.data.totalLocations).toBe("number")
        expect(typeof body.data.totalBranches).toBe("number")
        expect(typeof body.data.totalActiveEmployees).toBe("number")
    })

    test("should return zeros when no data exists", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/summary", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.data.totalAssets).toBe(0)
        expect(body.data.totalPrice).toBe(0)
        expect(body.data.totalBookValue).toBe(0)
        expect(body.data.totalDepreciation).toBe(0)
    })

    test("should work with status filter", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/summary?status=active", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data).toBeDefined()
        expect(typeof body.data.totalAssets).toBe("number")
        expect(typeof body.data.totalPrice).toBe("number")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/statistic/assets-by-category
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/statistic/assets-by-category", () => {
    test("should return array", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/assets-by-category", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Assets by category retrieved successfully")
        expect(body.data).toBeArray()
    })

    test("should return correct shape with data", async () => {
        const { headers } = await registerAndLogin(app)

        // Create category, sub-category, location, and asset
        const catRes = await request(app, "/api/category", {
            method: "POST", headers, body: { name: "Test Category" },
        })
        const subCatRes = await request(app, "/api/sub-category", {
            method: "POST", headers,
            body: { name: "Test SubCategory", categoryId: catRes.body.data.id },
        })
        const branchRes = await request(app, "/api/branch", {
            method: "POST", headers, body: { name: "Test Branch" },
        })
        const locRes = await request(app, "/api/location", {
            method: "POST", headers,
            body: { name: "Test Location", branchId: branchRes.body.data.id },
        })
        await request(app, "/api/asset", {
            method: "POST", headers,
            body: {
                code: "AST-001", name: "Test Asset",
                subCategoryId: subCatRes.body.data.id,
                locationId: locRes.body.data.id,
                locationDate: "2026-01-01",
                price: 1000,
            },
        })

        const { status, body } = await request(app, "/api/statistic/assets-by-category", {
            method: "GET", headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBeGreaterThan(0)
        const item = body.data[0]
        expect(typeof item.name).toBe("string")
        expect(typeof item.count).toBe("number")
        expect(typeof item.totalPrice).toBe("number")
        expect(typeof item.totalBookValue).toBe("number")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/statistic/assets-by-location
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/statistic/assets-by-location", () => {
    test("should return array", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/assets-by-location", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Assets by location retrieved successfully")
        expect(body.data).toBeArray()
    })

    test("should return correct shape with data", async () => {
        const { headers } = await registerAndLogin(app)

        // Create supporting data
        const catRes = await request(app, "/api/category", {
            method: "POST", headers, body: { name: "Loc Category" },
        })
        const subCatRes = await request(app, "/api/sub-category", {
            method: "POST", headers,
            body: { name: "Loc SubCategory", categoryId: catRes.body.data.id },
        })
        const branchRes = await request(app, "/api/branch", {
            method: "POST", headers, body: { name: "Loc Branch" },
        })
        const locRes = await request(app, "/api/location", {
            method: "POST", headers,
            body: { name: "Loc Location", branchId: branchRes.body.data.id },
        })
        await request(app, "/api/asset", {
            method: "POST", headers,
            body: {
                code: "AST-LOC", name: "Location Asset",
                subCategoryId: subCatRes.body.data.id,
                locationId: locRes.body.data.id,
                locationDate: "2026-01-01",
                price: 5000,
            },
        })

        const { status, body } = await request(app, "/api/statistic/assets-by-location", {
            method: "GET", headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBeGreaterThan(0)
        const item = body.data[0]
        expect(typeof item.name).toBe("string")
        expect(typeof item.count).toBe("number")
        expect(typeof item.totalPrice).toBe("number")
        expect(typeof item.totalBookValue).toBe("number")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/statistic/assets-by-sub-category
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/statistic/assets-by-sub-category", () => {
    test("should return array", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/assets-by-sub-category", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Assets by sub category retrieved successfully")
        expect(body.data).toBeArray()
    })

    test("should return correct shape with data", async () => {
        const { headers } = await registerAndLogin(app)

        // Create supporting data
        const catRes = await request(app, "/api/category", {
            method: "POST", headers, body: { name: "SC Category" },
        })
        const subCatRes = await request(app, "/api/sub-category", {
            method: "POST", headers,
            body: { name: "SC SubCategory", categoryId: catRes.body.data.id },
        })
        const branchRes = await request(app, "/api/branch", {
            method: "POST", headers, body: { name: "SC Branch" },
        })
        const locRes = await request(app, "/api/location", {
            method: "POST", headers,
            body: { name: "SC Location", branchId: branchRes.body.data.id },
        })
        await request(app, "/api/asset", {
            method: "POST", headers,
            body: {
                code: "AST-SC", name: "SubCat Asset",
                subCategoryId: subCatRes.body.data.id,
                locationId: locRes.body.data.id,
                locationDate: "2026-01-01",
                price: 3000,
            },
        })

        const { status, body } = await request(app, "/api/statistic/assets-by-sub-category", {
            method: "GET", headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBeGreaterThan(0)
        const item = body.data[0]
        expect(typeof item.name).toBe("string")
        expect(typeof item.count).toBe("number")
        expect(typeof item.totalPrice).toBe("number")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/statistic/asset-aging
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/statistic/asset-aging", () => {
    test("should return 3 items with correct labels", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/asset-aging", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Asset aging retrieved successfully")
        expect(body.data).toBeArray()
        expect(body.data.length).toBe(3)

        // Verify labels
        expect(body.data[0].label).toBe("0-2 Years")
        expect(body.data[1].label).toBe("3-5 Years")
        expect(body.data[2].label).toBe(">5 Years")

        // Verify count type
        expect(typeof body.data[0].count).toBe("number")
        expect(typeof body.data[1].count).toBe("number")
        expect(typeof body.data[2].count).toBe("number")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/statistic/data-quality
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/statistic/data-quality", () => {
    test("should return 6 items with correct labels", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/data-quality", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Data quality retrieved successfully")
        expect(body.data).toBeArray()
        expect(body.data.length).toBe(6)

        // Verify labels
        const labels = body.data.map((item: any) => item.label)
        expect(labels).toContain("Without Image")
        expect(labels).toContain("Without Price")
        expect(labels).toContain("Without Brand")
        expect(labels).toContain("Without Model")
        expect(labels).toContain("Without Purchase Date")
        expect(labels).toContain("Without Depreciation")

        // Verify count type
        for (const item of body.data) {
            expect(typeof item.count).toBe("number")
        }
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/statistic/depreciation
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/statistic/depreciation", () => {
    test("should return summary, statusBreakdown, byCategory", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/statistic/depreciation", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Depreciation statistics retrieved successfully")
        expect(body.data).toBeDefined()

        // Verify summary
        expect(body.data.summary).toBeDefined()
        expect(typeof body.data.summary.totalWithDepreciation).toBe("number")
        expect(typeof body.data.summary.totalMonthlyDepreciation).toBe("number")
        expect(typeof body.data.summary.totalAccumulatedDepreciation).toBe("number")
        expect(typeof body.data.summary.totalBookValue).toBe("number")

        // Verify statusBreakdown
        expect(body.data.statusBreakdown).toBeArray()
        expect(body.data.statusBreakdown.length).toBe(3)
        const breakdownLabels = body.data.statusBreakdown.map((item: any) => item.label)
        expect(breakdownLabels).toContain("Has Depreciation")
        expect(breakdownLabels).toContain("No Depreciation")
        expect(breakdownLabels).toContain("Fully Depreciated")

        // Verify byCategory
        expect(body.data.byCategory).toBeArray()
    })
})
