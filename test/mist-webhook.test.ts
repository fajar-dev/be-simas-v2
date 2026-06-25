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
let branchId: number

const TEST_MAC = "aa:bb:cc:dd:ee:ff"
const TEST_ZONE_ID = "zone-uuid-1234"
const WEBHOOK_SECRET = "test-mist-secret"

beforeAll(async () => {
    // Set the webhook secret for tests
    process.env.MIST_WEBHOOK_SECRET = WEBHOOK_SECRET
    await initTestDatabase()
    app = createTestApp()
})

afterAll(async () => {
    delete process.env.MIST_WEBHOOK_SECRET
    await destroyTestDatabase()
})

beforeEach(async () => {
    await cleanTestDatabase()
    const login = await registerAndLogin(app)
    authHeaders = login.headers

    // Setup: Create Branch
    const branchRes = await request(app, "/api/branch", {
        method: "POST",
        headers: authHeaders,
        body: { code: "BR-HQ", name: "HQ Branch", description: "Headquarters" },
    })
    branchId = branchRes.body.data.id

    // Setup: Create Location with mistZoneId
    const locRes = await request(app, "/api/location", {
        method: "POST",
        headers: authHeaders,
        body: { name: "Server Room", description: "3rd Floor", branchId, mistZoneId: TEST_ZONE_ID },
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

    // Setup: Create Asset with bleTagMac
    const assetRes = await request(app, "/api/asset", {
        method: "POST",
        headers: authHeaders,
        body: {
            code: "AST-BLE-001",
            name: "BLE Tagged Laptop",
            subCategoryId: subRes.body.data.id,
            bleTagMac: TEST_MAC,
        },
    })
    assetId = assetRes.body.data.id
})

describe("Mist Webhook API Tests", () => {
    test("POST /api/webhook/mist - should reject without valid secret", async () => {
        const res = await request(app, "/api/webhook/mist", {
            method: "POST",
            body: {
                topic: "zone",
                events: [],
            },
        })
        expect(res.status).toBe(401)
    })

    test("POST /api/webhook/mist - should reject with wrong secret", async () => {
        const res = await request(app, "/api/webhook/mist?secret=wrong-secret", {
            method: "POST",
            body: {
                topic: "zone",
                events: [],
            },
        })
        expect(res.status).toBe(401)
    })

    test("POST /api/webhook/mist - should process zone enter event and create asset_location", async () => {
        const res = await request(app, "/api/webhook/mist", {
            method: "POST",
            headers: { "X-Mist-Secret": WEBHOOK_SECRET },
            body: {
                topic: "zone",
                events: [
                    {
                        site_id: "site-uuid-1234",
                        zone_id: TEST_ZONE_ID,
                        mac: TEST_MAC,
                        type: "enter",
                        timestamp: Math.floor(Date.now() / 1000),
                        name: "Server Room",
                    },
                ],
            },
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.processed).toBe(1)
        expect(res.body.data.results[0].status).toBe("relocated")
        expect(res.body.data.results[0].assetId).toBe(assetId)
        expect(res.body.data.results[0].locationId).toBe(locationId)

        // Verify asset_location was created
        const locRes = await request(app, `/api/asset-location?assetId=${assetId}`, {
            headers: authHeaders,
        })
        expect(locRes.status).toBe(200)
        expect(locRes.body.data).toHaveLength(1)
        expect(locRes.body.data[0].location.name).toBe("Server Room")
    })

    test("POST /api/webhook/mist - should skip zone exit events", async () => {
        const res = await request(app, "/api/webhook/mist", {
            method: "POST",
            headers: { "X-Mist-Secret": WEBHOOK_SECRET },
            body: {
                topic: "zone",
                events: [
                    {
                        site_id: "site-uuid-1234",
                        zone_id: TEST_ZONE_ID,
                        mac: TEST_MAC,
                        type: "exit",
                        timestamp: Math.floor(Date.now() / 1000),
                    },
                ],
            },
        })

        expect(res.status).toBe(200)
        expect(res.body.data.results[0].status).toBe("skipped")

        // Verify no asset_location was created
        const locRes = await request(app, `/api/asset-location?assetId=${assetId}`, {
            headers: authHeaders,
        })
        expect(locRes.status).toBe(200)
        expect(locRes.body.data).toHaveLength(0)
    })

    test("POST /api/webhook/mist - should return asset_not_found for unknown MAC", async () => {
        const res = await request(app, "/api/webhook/mist", {
            method: "POST",
            headers: { "X-Mist-Secret": WEBHOOK_SECRET },
            body: {
                topic: "zone",
                events: [
                    {
                        site_id: "site-uuid-1234",
                        zone_id: TEST_ZONE_ID,
                        mac: "ff:ff:ff:ff:ff:ff",
                        type: "enter",
                        timestamp: Math.floor(Date.now() / 1000),
                    },
                ],
            },
        })

        expect(res.status).toBe(200)
        expect(res.body.data.results[0].status).toBe("asset_not_found")
    })

    test("POST /api/webhook/mist - should return zone_not_mapped for unknown zone_id", async () => {
        const res = await request(app, "/api/webhook/mist", {
            method: "POST",
            headers: { "X-Mist-Secret": WEBHOOK_SECRET },
            body: {
                topic: "zone",
                events: [
                    {
                        site_id: "site-uuid-1234",
                        zone_id: "unknown-zone-id",
                        mac: TEST_MAC,
                        type: "enter",
                        timestamp: Math.floor(Date.now() / 1000),
                    },
                ],
            },
        })

        expect(res.status).toBe(200)
        expect(res.body.data.results[0].status).toBe("zone_not_mapped")
    })

    test("POST /api/webhook/mist - should prevent duplicate (asset already at location)", async () => {
        const timestamp = Math.floor(Date.now() / 1000)

        // First event: should relocate
        const res1 = await request(app, "/api/webhook/mist", {
            method: "POST",
            headers: { "X-Mist-Secret": WEBHOOK_SECRET },
            body: {
                topic: "zone",
                events: [
                    {
                        site_id: "site-uuid-1234",
                        zone_id: TEST_ZONE_ID,
                        mac: TEST_MAC,
                        type: "enter",
                        timestamp,
                    },
                ],
            },
        })
        expect(res1.body.data.results[0].status).toBe("relocated")

        // Second event: same zone, should be already_at_location
        const res2 = await request(app, "/api/webhook/mist", {
            method: "POST",
            headers: { "X-Mist-Secret": WEBHOOK_SECRET },
            body: {
                topic: "zone",
                events: [
                    {
                        site_id: "site-uuid-1234",
                        zone_id: TEST_ZONE_ID,
                        mac: TEST_MAC,
                        type: "enter",
                        timestamp: timestamp + 60,
                    },
                ],
            },
        })
        expect(res2.body.data.results[0].status).toBe("already_at_location")

        // Verify only 1 asset_location record exists
        const locRes = await request(app, `/api/asset-location?assetId=${assetId}`, {
            headers: authHeaders,
        })
        expect(locRes.body.data).toHaveLength(1)
    })

    test("POST /api/webhook/mist - should ignore non-zone topics", async () => {
        const res = await request(app, "/api/webhook/mist", {
            method: "POST",
            headers: { "X-Mist-Secret": WEBHOOK_SECRET },
            body: {
                topic: "device",
                events: [],
            },
        })

        expect(res.status).toBe(200)
        expect(res.body.data.message).toContain("device")
    })

    test("POST /api/webhook/mist - should accept secret via query parameter", async () => {
        const res = await request(app, `/api/webhook/mist?secret=${WEBHOOK_SECRET}`, {
            method: "POST",
            body: {
                topic: "zone",
                events: [
                    {
                        site_id: "site-uuid-1234",
                        zone_id: TEST_ZONE_ID,
                        mac: TEST_MAC,
                        type: "enter",
                        timestamp: Math.floor(Date.now() / 1000),
                    },
                ],
            },
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.results[0].status).toBe("relocated")
    })
})
