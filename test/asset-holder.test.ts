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

// ── Mock MinIO to prevent real connections ──────────────────────────────────
mock.module("../src/core/helpers/minio", () => {
    const helper = {
        upload: async () => "attachments/test-file.txt",
        getProxyUrl: (name: string) => `http://cdn.test.com/stock/${name}`,
        getPresignedUrl: async (name: string) => `http://cdn.test.com/stock/${name}`,
        delete: async () => {},
        ensureBucket: async () => {},
    }
    return { minio: helper, default: helper }
})

let app: Hono
let authHeaders: Record<string, string>
let assetId: number
let employeeId: number

beforeAll(async () => {
    await initTestDatabase()
    app = createTestApp()
})

afterAll(async () => {
    await destroyTestDatabase()
})

beforeEach(async () => {
    await cleanTestDatabase()
    const login = await registerAndLogin(app)
    authHeaders = login.headers

    // Setup: Create Employee
    const empRes = await request(app, "/api/employee", {
        method: "POST",
        headers: authHeaders,
        body: {
            employeeId: "EMP-777",
            name: "Alice Assignment",
            jobPosition: "Developer",
            email: "alice@assignment.com",
            phone: "08123456789"
        }
    })
    employeeId = empRes.body.data.id

    // Setup: Create Category and SubCategory
    const catRes = await request(app, "/api/category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "CAT-H", name: "Category H" },
    })
    const subRes = await request(app, "/api/sub-category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "SUB-H", name: "Sub Category H", categoryId: catRes.body.data.id },
    })

    // Setup: Create Asset
    const assetRes = await request(app, "/api/asset", {
        method: "POST",
        headers: authHeaders,
        body: { code: "AST-H01", name: "Dell Precision", subCategoryId: subRes.body.data.id },
    })
    assetId = assetRes.body.data.id
})

describe("Asset Holder API Tests", () => {
    test("POST /api/asset-holder - assign successfully", async () => {
        const payload = {
            assetId,
            employeeId,
            assignedDate: "2026-06-19",
            assignNote: "Given to Alice",
        }

        const res = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: payload,
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.asset.id).toBe(assetId)
        expect(res.body.data.employee.id).toBe(employeeId)
        expect(res.body.data.assignedDate).toBe("2026-06-19")
        expect(res.body.data.returnedDate).toBeNull()
        expect(res.body.data.assignNote).toBe("Given to Alice")
        expect(res.body.data.asset.name).toBe("Dell Precision")
        expect(res.body.data.employee.name).toBe("Alice Assignment")
        expect(res.body.data.createdBy.name).toBe("Test User")
    })

    test("POST /api/asset-holder - prevent double assignment", async () => {
        // First assignment
        await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-06-19" },
        })

        // Second assignment (should fail because asset is active)
        const res = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-06-20" },
        })

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
        expect(res.body.message).toContain("assigned")
    })

    test("POST /api/asset-holder/:id/return - return successfully", async () => {
        // Assign first
        const assignRes = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-06-19" },
        })
        const logId = assignRes.body.data.id

        // Return
        const returnRes = await request(app, `/api/asset-holder/${logId}/return`, {
            method: "POST",
            headers: authHeaders,
            body: { returnedDate: "2026-06-21", returnNote: "Returned clean" },
        })

        expect(returnRes.status).toBe(200)
        expect(returnRes.body.success).toBe(true)
        expect(returnRes.body.data.returnedDate).toBe("2026-06-21")
        expect(returnRes.body.data.returnNote).toBe("Returned clean")
        expect(returnRes.body.data.returnedBy.name).toBe("Test User")

        // Now asset should be free to be assigned again!
        const reassignRes = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-06-22" },
        })
        expect(reassignRes.status).toBe(201)
    })

    test("POST /api/asset-holder/:id/return - prevent double return", async () => {
        // Assign
        const assignRes = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-06-19" },
        })
        const logId = assignRes.body.data.id

        // Return 1st time
        await request(app, `/api/asset-holder/${logId}/return`, {
            method: "POST",
            headers: authHeaders,
            body: { returnedDate: "2026-06-21" },
        })

        // Return 2nd time (should fail)
        const returnRes2 = await request(app, `/api/asset-holder/${logId}/return`, {
            method: "POST",
            headers: authHeaders,
            body: { returnedDate: "2026-06-22" },
        })

        expect(returnRes2.status).toBe(400)
        expect(returnRes2.body.success).toBe(false)
        expect(returnRes2.body.message).toContain("returned")
    })

    test("GET /api/asset-holder/active/:assetId - retrieve active holder", async () => {
        // Initially no active holder
        const resInit = await request(app, `/api/asset-holder/active/${assetId}`, {
            headers: authHeaders,
        })
        expect(resInit.status).toBe(200)
        expect(resInit.body.data).toBeNull()

        // Assign
        await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-06-19" },
        })

        // Now should have active holder
        const resActive = await request(app, `/api/asset-holder/active/${assetId}`, {
            headers: authHeaders,
        })
        expect(resActive.status).toBe(200)
        expect(resActive.body.data.employee.name).toBe("Alice Assignment")
    })

    test("POST /api/asset-holder - should fail when asset status is not active", async () => {
        // Set asset status to "under_repair"
        await request(app, "/api/asset-status", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, status: "under_repair", note: "Repairing" },
        })

        // Try to assign - should fail
        const res = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-01" },
        })

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
        expect(res.body.message).toContain("active")
    })

    test("POST /api/asset-holder - should succeed when asset status is active", async () => {
        // Set asset status to "active"
        await request(app, "/api/asset-status", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, status: "active" },
        })

        // Assign - should succeed
        const res = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, employeeId, assignedDate: "2026-07-01" },
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
    })
})
