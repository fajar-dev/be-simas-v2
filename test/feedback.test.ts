import { describe, test, expect, beforeAll, afterAll, beforeEach, mock, spyOn } from "bun:test"
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

// ── Mock MinIO & External Fetch ─────────────────────────────────────────────

// Mock minio module to prevent real uploads
mock.module("../src/core/helpers/minio", () => ({
    minio: {
        upload: async () => {},
        getProxyUrl: (objectName: string) => `https://cdn.test.com/${objectName}`,
        getPresignedUrl: async (path: string) => `https://cdn.test.com/signed/${path}`,
        proxyHandler: async () => new Response("ok"),
    },
    default: {
        upload: async () => {},
        getProxyUrl: (objectName: string) => `https://cdn.test.com/${objectName}`,
        getPresignedUrl: async (path: string) => `https://cdn.test.com/signed/${path}`,
        proxyHandler: async () => new Response("ok"),
    },
}))

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function createFormData(fields: {
    message?: string
    type?: string
    url?: string
    images?: File[]
}): FormData {
    const form = new FormData()
    if (fields.message !== undefined) form.append("message", fields.message)
    if (fields.type !== undefined) form.append("type", fields.type)
    if (fields.url !== undefined) form.append("url", fields.url)
    if (fields.images) {
        for (const img of fields.images) {
            form.append("images[]", img)
        }
    }
    return form
}

function createTestImage(name: string = "test.png"): File {
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG magic bytes
    return new File([buffer], name, { type: "image/png" })
}

async function requestForm(
    app: Hono,
    path: string,
    options: { method?: string; headers?: Record<string, string>; body?: FormData }
) {
    const { method = "POST", headers = {}, body } = options

    const init: RequestInit = {
        method,
        headers: { ...headers },
    }

    if (body) {
        init.body = body
    }

    const res = await app.request(path, init)
    const json = (await res.json()) as any

    return { status: res.status, body: json }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/feedback
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/feedback", () => {
    test("should fail without auth token", async () => {
        const { status, body } = await request(app, "/api/feedback", {
            method: "GET",
        })

        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("should fail with invalid auth token", async () => {
        const { status, body } = await request(app, "/api/feedback", {
            method: "GET",
            headers: { Authorization: "Bearer invalid-token" },
        })

        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("should return feedback list for authenticated user", async () => {
        const { headers } = await registerAndLogin(app)

        // Mock the external fetch for getByUser
        const originalFetch = globalThis.fetch
        globalThis.fetch = (async (input: any, init?: any) => {
            // If it's a GET to the script URL (getByUser), return empty array
            if (typeof input === "string" && !init?.method) {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            }
            // Otherwise, if it has a method specified (like POST), return the original
            if (init?.method === "POST") {
                return new Response("ok", { status: 200 })
            }
            return originalFetch(input, init)
        }) as any

        try {
            const { status, body } = await request(app, "/api/feedback", {
                method: "GET",
                headers,
            })

            expect(status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.message).toBe("Feedback retrieved successfully")
            expect(Array.isArray(body.data)).toBe(true)
        } finally {
            globalThis.fetch = originalFetch
        }
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/feedback
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/feedback", () => {
    test("should fail without auth token", async () => {
        const form = createFormData({
            message: "Test feedback",
            type: "bug",
            images: [createTestImage()],
        })

        const { status, body } = await requestForm(app, "/api/feedback", {
            method: "POST",
            body: form,
        })

        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("should fail validation when message is missing", async () => {
        const { headers } = await registerAndLogin(app)

        const form = createFormData({
            type: "bug",
            images: [createTestImage()],
        })

        const { status, body } = await requestForm(app, "/api/feedback", {
            method: "POST",
            headers,
            body: form,
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation when type is missing", async () => {
        const { headers } = await registerAndLogin(app)

        const form = createFormData({
            message: "Test feedback",
            images: [createTestImage()],
        })

        const { status, body } = await requestForm(app, "/api/feedback", {
            method: "POST",
            headers,
            body: form,
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation when images are missing", async () => {
        const { headers } = await registerAndLogin(app)

        const form = createFormData({
            message: "Test feedback",
            type: "bug",
        })

        const { status, body } = await requestForm(app, "/api/feedback", {
            method: "POST",
            headers,
            body: form,
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation when non-image file is uploaded", async () => {
        const { headers } = await registerAndLogin(app)

        const textFile = new File([new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])], "test.txt", {
            type: "text/plain",
        })

        const form = createFormData({
            message: "Test feedback",
            type: "bug",
            images: [textFile],
        })

        const { status, body } = await requestForm(app, "/api/feedback", {
            method: "POST",
            headers,
            body: form,
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should submit feedback successfully with required fields", async () => {
        const { headers } = await registerAndLogin(app)

        // Mock external fetch for store (fire-and-forget POST)
        const originalFetch = globalThis.fetch
        globalThis.fetch = (async (input: any, init?: any) => {
            if (init?.method === "POST") {
                return new Response("ok", { status: 200 })
            }
            return originalFetch(input, init)
        }) as any

        try {
            const form = createFormData({
                message: "Button tidak berfungsi",
                type: "bug",
                images: [createTestImage()],
            })

            const { status, body } = await requestForm(app, "/api/feedback", {
                method: "POST",
                headers,
                body: form,
            })

            expect(status).toBe(201)
            expect(body.success).toBe(true)
            expect(body.message).toBe("Feedback submitted successfully")
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    test("should submit feedback successfully with optional url", async () => {
        const { headers } = await registerAndLogin(app)

        const originalFetch = globalThis.fetch
        globalThis.fetch = (async (input: any, init?: any) => {
            if (init?.method === "POST") {
                return new Response("ok", { status: 200 })
            }
            return originalFetch(input, init)
        }) as any

        try {
            const form = createFormData({
                message: "Halaman lambat",
                type: "performance",
                url: "https://simas.nusa.net.id/dashboard",
                images: [createTestImage()],
            })

            const { status, body } = await requestForm(app, "/api/feedback", {
                method: "POST",
                headers,
                body: form,
            })

            expect(status).toBe(201)
            expect(body.success).toBe(true)
            expect(body.message).toBe("Feedback submitted successfully")
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    test("should submit feedback successfully with multiple images", async () => {
        const { headers } = await registerAndLogin(app)

        const originalFetch = globalThis.fetch
        globalThis.fetch = (async (input: any, init?: any) => {
            if (init?.method === "POST") {
                return new Response("ok", { status: 200 })
            }
            return originalFetch(input, init)
        }) as any

        try {
            const form = createFormData({
                message: "Multiple screenshots",
                type: "bug",
                images: [
                    createTestImage("screenshot1.png"),
                    createTestImage("screenshot2.png"),
                    createTestImage("screenshot3.png"),
                ],
            })

            const { status, body } = await requestForm(app, "/api/feedback", {
                method: "POST",
                headers,
                body: form,
            })

            expect(status).toBe(201)
            expect(body.success).toBe(true)
        } finally {
            globalThis.fetch = originalFetch
        }
    })
})
