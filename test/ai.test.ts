import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test"
import { Hono } from "hono"
import {
    initTestDatabase,
    destroyTestDatabase,
    cleanTestDatabase,
    createTestApp,
    registerAndLogin,
} from "./setup"

// ── Mock Google Generative AI ───────────────────────────────────────────────
let mockGenerateContent: any

mock.module("@google/generative-ai", () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel() {
                return {
                    generateContent: (...args: any[]) => mockGenerateContent(...args),
                }
            }
        },
    }
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

describe("AI Decode Barcode API Tests", () => {
    test("POST /api/ai/decode-barcode - should decode a barcode image successfully", async () => {
        mockGenerateContent = async () => ({
            response: {
                text: () => JSON.stringify({ type: "barcode", content: "AST-001" }),
            },
        })

        const formData = new FormData()
        formData.append("image", new File(["fake-image-data"], "barcode.jpg", { type: "image/jpeg" }))

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: formData,
        })

        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.success).toBe(true)
        expect(body.data.type).toBe("barcode")
        expect(body.data.content).toBe("AST-001")
    })

    test("POST /api/ai/decode-barcode - should decode a QR code image successfully", async () => {
        mockGenerateContent = async () => ({
            response: {
                text: () => JSON.stringify({ type: "qrcode", content: "https://example.com/asset/123" }),
            },
        })

        const formData = new FormData()
        formData.append("image", new File(["fake-image-data"], "qrcode.png", { type: "image/png" }))

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: formData,
        })

        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.success).toBe(true)
        expect(body.data.type).toBe("qrcode")
        expect(body.data.content).toBe("https://example.com/asset/123")
    })

    test("POST /api/ai/decode-barcode - should return 400 when no barcode found", async () => {
        mockGenerateContent = async () => ({
            response: {
                text: () => JSON.stringify({ error: "NO_CODE_FOUND" }),
            },
        })

        const formData = new FormData()
        formData.append("image", new File(["fake-image-data"], "photo.jpg", { type: "image/jpeg" }))

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: formData,
        })

        expect(res.status).toBe(400)
        const body = await res.json() as any
        expect(body.success).toBe(false)
    })

    test("POST /api/ai/decode-barcode - should return 400 when image is unclear", async () => {
        mockGenerateContent = async () => ({
            response: {
                text: () => JSON.stringify({ error: "IMAGE_UNCLEAR" }),
            },
        })

        const formData = new FormData()
        formData.append("image", new File(["fake-image-data"], "blurry.jpg", { type: "image/jpeg" }))

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: formData,
        })

        expect(res.status).toBe(400)
        const body = await res.json() as any
        expect(body.success).toBe(false)
    })

    test("POST /api/ai/decode-barcode - should fail without image field", async () => {
        const formData = new FormData()

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: formData,
        })

        expect(res.status).toBe(400)
    })

    test("POST /api/ai/decode-barcode - should fail without auth", async () => {
        const formData = new FormData()
        formData.append("image", new File(["fake-image-data"], "barcode.jpg", { type: "image/jpeg" }))

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            body: formData,
        })

        expect(res.status).toBe(401)
    })

    test("POST /api/ai/decode-barcode - should handle markdown-wrapped JSON from Gemini", async () => {
        mockGenerateContent = async () => ({
            response: {
                text: () => '```json\n{"type": "barcode", "content": "ITEM-999"}\n```',
            },
        })

        const formData = new FormData()
        formData.append("image", new File(["fake-image-data"], "barcode.jpg", { type: "image/jpeg" }))

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: formData,
        })

        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.success).toBe(true)
        expect(body.data.content).toBe("ITEM-999")
    })

    test("POST /api/ai/decode-barcode - should return 400 when Gemini returns invalid JSON", async () => {
        mockGenerateContent = async () => ({
            response: {
                text: () => "I cannot read this image properly",
            },
        })

        const formData = new FormData()
        formData.append("image", new File(["fake-image-data"], "broken.jpg", { type: "image/jpeg" }))

        const res = await app.request("/api/ai/decode-barcode", {
            method: "POST",
            headers: { Authorization: authHeaders.Authorization },
            body: formData,
        })

        expect(res.status).toBe(400)
        const body = await res.json() as any
        expect(body.success).toBe(false)
    })
})
