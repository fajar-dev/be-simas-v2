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
let locationId2: number

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

    // Create a second location for sort/multi-relocation tests
    const locRes2 = await request(app, "/api/location", {
        method: "POST",
        headers: authHeaders,
        body: { name: "Server Room", description: "3rd Floor", branchId: branchRes.body.data.id },
    })
    locationId2 = locRes2.body.data.id

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

    test("GET /api/asset-location - sort results by note and createdBy", async () => {
        // Create two relocation logs with different notes and different locations
        await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, locationId, date: "2026-06-19", note: "B Note" },
        })
        await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, locationId: locationId2, date: "2026-06-20", note: "A Note" },
        })

        // Sort by note ASC
        const resNoteAsc = await request(app, `/api/asset-location?assetId=${assetId}&sortBy=note&order=ASC`, {
            headers: authHeaders,
        })
        expect(resNoteAsc.status).toBe(200)
        expect(resNoteAsc.body.data[0].note).toBe("A Note")
        expect(resNoteAsc.body.data[1].note).toBe("B Note")

        // Sort by createdBy ASC
        const resCreatedByAsc = await request(app, `/api/asset-location?assetId=${assetId}&sortBy=createdBy&order=ASC`, {
            headers: authHeaders,
        })
        expect(resCreatedByAsc.status).toBe(200)
        expect(resCreatedByAsc.body.data[0].createdBy.name).toBe("Test User")
    })

    test("POST /api/asset-location - prevent relocating to the same current location", async () => {
        // First relocation
        await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, locationId, date: "2026-06-19", note: "Initial move" },
        })

        // Second relocation to the same location should fail
        const res = await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, locationId, date: "2026-06-20", note: "Same location" },
        })
        expect(res.status).toBe(400)
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

    test("POST /api/asset-location - relocate with attachments", async () => {
        // Upload a file first
        const formData = new FormData()
        formData.append("file", new File(["test relocation doc"], "invoice.pdf", { type: "application/pdf" }))

        const uploadRes = await app.request("/api/attachment", {
            method: "POST",
            headers: {
                Authorization: authHeaders.Authorization,
            },
            body: formData,
        })
        const uploadBody = await uploadRes.json() as any
        const attachmentId = uploadBody.data.id

        // Perform relocation with attachments
        const payload = {
            assetId,
            locationId,
            date: "2026-06-19",
            note: "Relocating with invoice attachment",
            attachmentIds: [attachmentId],
        }

        const res = await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: payload,
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.attachments).toHaveLength(1)
        expect(res.body.data.attachments[0].id).toBe(attachmentId)
        expect(res.body.data.attachments[0].originalName).toBe("invoice.pdf")

        // Retrieve single details to verify attachments
        const showRes = await request(app, `/api/asset-location/${res.body.data.id}`, {
            headers: authHeaders,
        })
        expect(showRes.status).toBe(200)
        expect(showRes.body.data.attachments).toHaveLength(1)
        expect(showRes.body.data.attachments[0].originalName).toBe("invoice.pdf")

        // Retrieve list to verify attachments
        const listRes = await request(app, `/api/asset-location?assetId=${assetId}`, {
            headers: authHeaders,
        })
        expect(listRes.status).toBe(200)
        expect(listRes.body.data[0].attachments).toHaveLength(1)
        expect(listRes.body.data[0].attachments[0].originalName).toBe("invoice.pdf")
    })
})
