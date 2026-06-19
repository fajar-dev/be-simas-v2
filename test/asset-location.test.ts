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
let locationId: number

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

    // Setup: Create Branch & Location
    const branchRes = await request(app, "/api/branch", {
        method: "POST",
        headers: authHeaders,
        body: { code: "BR-HQ", name: "HQ Branch", description: "Headquarters" },
    })
    const locRes = await request(app, "/api/location", {
        method: "POST",
        headers: authHeaders,
        body: { name: "IT Room", description: "2nd Floor", branchId: branchRes.body.data.id },
    })
    locationId = locRes.body.data.id

    // Setup: Create Category and SubCategory
    const catRes = await request(app, "/api/category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "CAT", name: "Category Name" },
    })
    const subRes = await request(app, "/api/sub-category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "SUB", name: "Sub Category", categoryId: catRes.body.data.id },
    })

    // Setup: Create Asset
    const assetRes = await request(app, "/api/asset", {
        method: "POST",
        headers: authHeaders,
        body: { code: "AST-100", name: "Workstation Dell", subCategoryId: subRes.body.data.id },
    })
    assetId = assetRes.body.data.id
})

describe("Asset Location API Tests", () => {
    test("POST /api/asset-location - relocate successfully", async () => {
        const payload = {
            assetId,
            locationId,
            date: "2026-06-19",
            note: "Moved workstation to HQ IT Room",
        }

        const res = await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: payload,
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.assetId).toBe(assetId)
        expect(res.body.data.locationId).toBe(locationId)
        expect(res.body.data.date).toBe("2026-06-19")
        expect(res.body.data.note).toBe(payload.note)
        expect(res.body.data.asset.name).toBe("Workstation Dell")
        expect(res.body.data.location.name).toBe("IT Room")
        expect(res.body.data.createdBy.name).toBe("Test User")
        expect(res.body.data.createdBy.photo).toBeNull()
    })

    test("POST /api/asset-location - validate missing locationId", async () => {
        const res = await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, date: "2026-06-19" },
        })
        expect(res.status).toBe(422)
    })

    test("POST /api/asset-location - validate non-existent location", async () => {
        const res = await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, locationId: 9999, date: "2026-06-19" },
        })
        expect(res.status).toBe(404)
    })

    test("GET /api/asset-location - retrieve list and filter by assetId", async () => {
        // Create relocation log
        await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, locationId, date: "2026-06-19", note: "Moved first" },
        })

        const res = await request(app, `/api/asset-location?assetId=${assetId}`, {
            headers: authHeaders,
        })
        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].note).toBe("Moved first")
        expect(res.body.data[0].location.name).toBe("IT Room")
        expect(res.body.data[0].createdBy.name).toBe("Test User")
    })

    test("GET /api/asset-location/:id - retrieve single log details", async () => {
        // Create relocation log
        const createRes = await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, locationId, date: "2026-06-19", note: "Find me" },
        })
        const logId = createRes.body.data.id

        const res = await request(app, `/api/asset-location/${logId}`, {
            headers: authHeaders,
        })
        expect(res.status).toBe(200)
        expect(res.body.data.note).toBe("Find me")
        expect(res.body.data.location.name).toBe("IT Room")
        expect(res.body.data.asset.name).toBe("Workstation Dell")
    })

    test("GET /api/asset-location/:id - return 404 for non-existent log", async () => {
        const res = await request(app, "/api/asset-location/9999", {
            headers: authHeaders,
        })
        expect(res.status).toBe(404)
    })
})
