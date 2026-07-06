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
        body: { code: "AST-999", name: "Laptop HP", subCategoryId: subRes.body.data.id },
    })
    assetId = assetRes.body.data.id
})

describe("Asset Note API Tests", () => {
    test("POST /api/asset-note - create successfully", async () => {
        const payload = {
            assetId,
            date: "2026-06-19",
            note: "Cleaned fans and re-pasted CPU thermal paste",
        }

        const res = await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: payload,
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.assetId).toBe(assetId)
        expect(res.body.data.date).toBe("2026-06-19")
        expect(res.body.data.note).toBe(payload.note)
        expect(res.body.data.asset.name).toBe("Laptop HP")
        expect(res.body.data.createdBy.name).toBe("Test User")
        expect(res.body.data.createdBy.photo).toBeNull()
        expect(res.body.data.attachments).toHaveLength(0)
    })

    test("POST /api/asset-note - validate missing assetId", async () => {
        const res = await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: { date: "2026-06-19" },
        })
        expect(res.status).toBe(422)
    })

    test("POST /api/asset-note - with multiple attachments", async () => {
        // 1. Upload two files to get attachment IDs
        const fd1 = new FormData()
        fd1.append("file", new File(["txt1"], "doc1.txt", { type: "text/plain" }))
        const up1 = await app.request("/api/attachment", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: fd1,
        })
        const upBody1 = await up1.json() as any
        const attId1 = upBody1.data.id

        const fd2 = new FormData()
        fd2.append("file", new File(["txt2"], "doc2.txt", { type: "text/plain" }))
        const up2 = await app.request("/api/attachment", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: fd2,
        })
        const upBody2 = await up2.json() as any
        const attId2 = upBody2.data.id

        // 2. Create asset note with attachment IDs
        const payload = {
            assetId,
            date: "2026-06-19",
            note: "Repaired keyboard and trackpad",
            attachmentIds: [attId1, attId2],
        }

        const res = await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: payload,
        })

        expect(res.status).toBe(201)
        expect(res.body.data.attachments).toHaveLength(2)
        expect(res.body.data.attachments[0].originalName).toBe("doc1.txt")
        expect(res.body.data.attachments[1].originalName).toBe("doc2.txt")
    })

    test("GET /api/asset-note - retrieve list and filter", async () => {
        // Create one record
        await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, date: "2026-06-19", note: "Periodic test" },
        })

        const res = await request(app, `/api/asset-note?assetId=${assetId}`, {
            headers: authHeaders,
        })
        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].note).toBe("Periodic test")
        expect(res.body.data[0].createdBy.name).toBe("Test User")
        expect(res.body.data[0].createdBy.photo).toBeNull()
    })

    test("PUT /api/asset-note/:id - update record and attachments", async () => {
        // 1. Create note with attachment 1
        const fd1 = new FormData()
        fd1.append("file", new File(["txt1"], "doc1.txt", { type: "text/plain" }))
        const up1 = await app.request("/api/attachment", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: fd1,
        })
        const attId1 = (await up1.json() as any).data.id

        const createRes = await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, date: "2026-06-19", note: "Initial", attachmentIds: [attId1] },
        })
        const noteId = createRes.body.data.id

        // 2. Upload attachment 2
        const fd2 = new FormData()
        fd2.append("file", new File(["txt2"], "doc2.txt", { type: "text/plain" }))
        const up2 = await app.request("/api/attachment", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: fd2,
        })
        const attId2 = (await up2.json() as any).data.id

        // 3. Update note: remove attachment 1, add attachment 2
        const updateRes = await request(app, `/api/asset-note/${noteId}`, {
            method: "PUT",
            headers: authHeaders,
            body: {
                note: "Updated note text",
                attachmentIds: [attId2], // doc2.txt
            },
        })

        expect(updateRes.status).toBe(200)
        expect(updateRes.body.data.note).toBe("Updated note text")
        expect(updateRes.body.data.attachments).toHaveLength(1)
        expect(updateRes.body.data.attachments[0].originalName).toBe("doc2.txt")
    })

    test("DELETE /api/asset-note/:id - delete record and files", async () => {
        // Create note
        const createRes = await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: { assetId, date: "2026-06-19", note: "To delete" },
        })
        const id = createRes.body.data.id

        const delRes = await request(app, `/api/asset-note/${id}`, {
            method: "DELETE",
            headers: authHeaders,
        })
        expect(delRes.status).toBe(200)

        // Verify 404
        const showRes = await request(app, `/api/asset-note/${id}`, {
            headers: authHeaders,
        })
        expect(showRes.status).toBe(404)
    })

    test("POST /api/asset-note - create with labels", async () => {
        const payload = {
            assetId,
            date: "2026-06-22",
            note: "Note with labels",
            labels: [
                { key: "category", value: "inspection" },
                { key: "status", value: "reviewed" },
            ],
        }

        const res = await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: payload,
        })

        expect(res.status).toBe(201)
        expect(res.body.data.labels).toHaveLength(2)
        expect(res.body.data.labels[0].key).toBe("category")
        expect(res.body.data.labels[0].value).toBe("inspection")
        expect(res.body.data.labels[1].key).toBe("status")
        expect(res.body.data.labels[1].value).toBe("reviewed")
    })

    test("GET /api/asset-note - search by label value", async () => {
        await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetId,
                date: "2026-06-22",
                note: "Labeled note",
                labels: [{ key: "region", value: "Surabaya" }],
            },
        })

        const res = await request(app, `/api/asset-note?q=Surabaya`, {
            headers: authHeaders,
        })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(1)
        expect(res.body.data[0].note).toBe("Labeled note")
    })

    test("GET /api/asset-note/label-keys - with assetId filter", async () => {
        await request(app, "/api/asset-note", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetId,
                date: "2026-06-22",
                note: "For label keys",
                labels: [{ key: "team", value: "Engineering" }],
            },
        })

        const res = await request(app, `/api/asset-note/label-keys?assetId=${assetId}`, {
            headers: authHeaders,
        })
        expect(res.status).toBe(200)
        expect(res.body.data).toContain("team")
    })
})
