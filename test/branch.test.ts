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

let branchCounter = 0

function createBranchData(overrides: Record<string, any> = {}) {
    branchCounter++
    return {
        code: `BR-${String(branchCounter).padStart(3, "0")}`,
        name: `Branch ${branchCounter}`,
        description: `Description for branch ${branchCounter}`,
        ...overrides,
    }
}

// Reset branch counter in beforeEach
beforeEach(() => {
    branchCounter = 0
})

// ═══════════════════════════════════════════════════════════════════════════
// Authentication Required — All branch routes need auth
// ═══════════════════════════════════════════════════════════════════════════

describe("Branch - Auth Required", () => {
    test("GET /api/branch should fail without auth", async () => {
        const { status, body } = await request(app, "/api/branch")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("POST /api/branch should fail without auth", async () => {
        const { status, body } = await request(app, "/api/branch", {
            method: "POST",
            body: createBranchData(),
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("GET /api/branch/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/branch/1")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("PUT /api/branch/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/branch/1", {
            method: "PUT",
            body: { name: "Updated" },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("DELETE /api/branch/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/branch/1", {
            method: "DELETE",
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/branch — Create
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/branch", () => {
    test("should create a branch successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const branchData = createBranchData()

        const { status, body } = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: branchData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Branch created successfully")
        expect(body.data).toBeDefined()
        expect(body.data.code).toBe(branchData.code)
        expect(body.data.name).toBe(branchData.name)
        expect(body.data.description).toBe(branchData.description)
        expect(body.data.id).toBeDefined()
        expect(body.data.createdAt).toBeDefined()
        expect(body.data.updatedAt).toBeDefined()
    })

    test("should create a branch without description", async () => {
        const { headers } = await registerAndLogin(app)
        const branchData = createBranchData({ description: undefined })
        delete branchData.description

        const { status, body } = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: branchData.code, name: branchData.name },
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.description).toBeNull()
    })

    test("should fail validation without code", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { name: "Test Branch" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation without name", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-001" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/branch — List
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/branch", () => {
    test("should return empty list initially", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/branch", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Branches retrieved successfully")
        expect(body.data).toBeArray()
        expect(body.data.length).toBe(0)
        expect(body.meta).toBeDefined()
        expect(body.meta.total).toBe(0)
    })

    test("should return created branches", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData(),
        })
        await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData(),
        })

        const { status, body } = await request(app, "/api/branch", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBe(2)
        expect(body.meta.total).toBe(2)
    })

    test("should search branches by name", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData({ name: "Jakarta Branch" }),
        })
        await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData({ name: "Surabaya Branch" }),
        })

        const { body } = await request(app, "/api/branch?q=Jakarta", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].name).toBe("Jakarta Branch")
    })

    test("should search branches by code", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData({ code: "JKT-001" }),
        })
        await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData({ code: "SBY-001" }),
        })

        const { body } = await request(app, "/api/branch?q=JKT", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].code).toBe("JKT-001")
    })

    test("should paginate results", async () => {
        const { headers } = await registerAndLogin(app)

        for (let i = 0; i < 3; i++) {
            await request(app, "/api/branch", {
                method: "POST",
                headers,
                body: createBranchData(),
            })
        }

        const { body } = await request(app, "/api/branch?page=1&limit=2", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(2)
        expect(body.meta.total).toBe(3)
        expect(body.meta.currentPage).toBe(1)
        expect(body.meta.lastPage).toBe(2)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/branch/:id — Show
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/branch/:id", () => {
    test("should return branch by ID", async () => {
        const { headers } = await registerAndLogin(app)
        const branchData = createBranchData()

        const createRes = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: branchData,
        })
        const branchId = createRes.body.data.id

        const { status, body } = await request(app, `/api/branch/${branchId}`, {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Branch retrieved successfully")
        expect(body.data.id).toBe(branchId)
        expect(body.data.code).toBe(branchData.code)
        expect(body.data.name).toBe(branchData.name)
        expect(body.data.description).toBe(branchData.description)
    })

    test("should return 404 for non-existent branch", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/branch/99999", {
            method: "GET",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Branch not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/branch/:id — Update
// ═══════════════════════════════════════════════════════════════════════════

describe("PUT /api/branch/:id", () => {
    test("should update branch details successfully", async () => {
        const { headers } = await registerAndLogin(app)

        const createRes = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData(),
        })
        const branchId = createRes.body.data.id

        const { status, body } = await request(app, `/api/branch/${branchId}`, {
            method: "PUT",
            headers,
            body: { name: "Updated Branch", description: "Updated description" },
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Branch updated successfully")
        expect(body.data.name).toBe("Updated Branch")
        expect(body.data.description).toBe("Updated description")
    })

    test("should return 404 when updating non-existent branch", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/branch/99999", {
            method: "PUT",
            headers,
            body: { name: "Updated" },
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Branch not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/branch/:id — Destroy
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /api/branch/:id", () => {
    test("should delete branch successfully", async () => {
        const { headers } = await registerAndLogin(app)

        const createRes = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: createBranchData(),
        })
        const branchId = createRes.body.data.id

        const { status, body } = await request(app, `/api/branch/${branchId}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Branch deleted successfully")

        // Verify it's deleted
        const { status: getStatus } = await request(app, `/api/branch/${branchId}`, {
            method: "GET",
            headers,
        })
        expect(getStatus).toBe(404)
    })

    test("should return 404 when deleting non-existent branch", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/branch/99999", {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Branch not found")
    })
})
