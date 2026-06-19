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
})

describe("Attachment API Tests", () => {
    test("POST /api/attachment - should upload a file successfully", async () => {
        const formData = new FormData()
        formData.append("file", new File(["test file content"], "hello.txt", { type: "text/plain" }))

        const res = await app.request("/api/attachment", {
            method: "POST",
            headers: {
                Authorization: authHeaders.Authorization,
            },
            body: formData,
        })

        expect(res.status).toBe(201)
        const body = await res.json() as any
        expect(body.success).toBe(true)
        expect(body.data.originalName).toBe("hello.txt")
        expect(body.data.mimeType).toContain("text/plain")
        expect(body.data.size).toBeGreaterThan(0)
        expect(body.data.url).toContain("hello.txt")
    })

    test("POST /api/attachment - should fail with no file", async () => {
        const formData = new FormData()
        // No file appended

        const res = await app.request("/api/attachment", {
            method: "POST",
            headers: {
                Authorization: authHeaders.Authorization,
            },
            body: formData,
        })

        expect(res.status).toBe(400)
    })

    test("DELETE /api/attachment/:id - should delete attachment successfully", async () => {
        // Upload first
        const formData = new FormData()
        formData.append("file", new File(["content"], "del.txt", { type: "text/plain" }))

        const uploadRes = await app.request("/api/attachment", {
            method: "POST",
            headers: {
                Authorization: authHeaders.Authorization,
            },
            body: formData,
        })
        const uploadBody = await uploadRes.json() as any
        const id = uploadBody.data.id

        // Delete
        const delRes = await request(app, `/api/attachment/${id}`, {
            method: "DELETE",
            headers: authHeaders,
        })
        expect(delRes.status).toBe(200)
        expect(delRes.body.success).toBe(true)

        // Verify deleted (returns 404)
        const checkRes = await request(app, `/api/attachment/${id}`, {
            method: "DELETE",
            headers: authHeaders,
        })
        expect(checkRes.status).toBe(404)
    })
})
