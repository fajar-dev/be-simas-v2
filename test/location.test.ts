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

let locationCounter = 0

function createLocationData(branchId: number, overrides: Record<string, any> = {}) {
    locationCounter++
    return {
        name: `Location ${locationCounter}`,
        description: `Description for location ${locationCounter}`,
        branchId,
        ...overrides,
    }
}

async function createTestBranch(app: Hono, headers: any) {
    const res = await request(app, "/api/branch", {
        method: "POST",
        headers,
        body: {
            code: "BR-001",
            name: "Test Branch",
            description: "Branch description"
        }
    })
    return res.body.data
}

// Reset location counter in beforeEach
beforeEach(() => {
    locationCounter = 0
})

// ═══════════════════════════════════════════════════════════════════════════
// Authentication Required — All location routes need auth
// ═══════════════════════════════════════════════════════════════════════════

describe("Location - Auth Required", () => {
    test("GET /api/location should fail without auth", async () => {
        const { status, body } = await request(app, "/api/location")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("POST /api/location should fail without auth", async () => {
        const { status, body } = await request(app, "/api/location", {
            method: "POST",
            body: { name: "Loc", branchId: 1 },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("GET /api/location/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/location/1")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("PUT /api/location/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/location/1", {
            method: "PUT",
            body: { name: "Updated" },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("DELETE /api/location/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/location/1", {
            method: "DELETE",
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/location — Create
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/location", () => {
    test("should create a location successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)
        const locationData = createLocationData(branch.id)

        const { status, body } = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: locationData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Location created successfully")
        expect(body.data).toBeDefined()
        expect(body.data.name).toBe(locationData.name)
        expect(body.data.description).toBe(locationData.description)
        expect(body.data.branch.id).toBe(branch.id)
        expect(body.data.branch).toBeDefined()
        expect(body.data.branch.id).toBe(branch.id)
        expect(body.data.branch.name).toBe(branch.name)
        expect(body.data.id).toBeDefined()
        expect(body.data.createdAt).toBeDefined()
        expect(body.data.updatedAt).toBeDefined()
    })

    test("should create a location without description", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)
        const locationData = createLocationData(branch.id, { description: undefined })
        delete locationData.description

        const { status, body } = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: locationData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.description).toBeNull()
    })

    test("should fail validation without branchId", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: { name: "Test Location" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation without name", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)

        const { status, body } = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: { branchId: branch.id },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/location — List
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/location", () => {
    test("should return empty list initially", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/location", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Locations retrieved successfully")
        expect(body.data).toBeArray()
        expect(body.data.length).toBe(0)
        expect(body.meta).toBeDefined()
        expect(body.meta.total).toBe(0)
    })

    test("should return created locations", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)

        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id),
        })
        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id),
        })

        const { status, body } = await request(app, "/api/location", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBe(2)
        expect(body.meta.total).toBe(2)
        expect(body.data[0].branch).toBeDefined()
        expect(body.data[0].branch.id).toBe(branch.id)
    })

    test("should search locations by name", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)

        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id, { name: "Room 101" }),
        })
        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id, { name: "Warehouse B" }),
        })

        const { body } = await request(app, "/api/location?q=Room", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].name).toBe("Room 101")
    })

    test("should search locations by description", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)

        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id, { description: "Contains server racks" }),
        })
        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id, { description: "Storage for general items" }),
        })

        const { body } = await request(app, "/api/location?q=server", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].description).toBe("Contains server racks")
    })

    test("should search locations by branch name", async () => {
        const { headers } = await registerAndLogin(app)
        
        // Create branch 1
        const branchRes1 = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-JKT", name: "Jakarta Main", description: "Main branch" }
        })
        const branch1 = branchRes1.body.data

        // Create branch 2
        const branchRes2 = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-SBY", name: "Surabaya Sub", description: "Sub branch" }
        })
        const branch2 = branchRes2.body.data

        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch1.id, { name: "Server Room" }),
        })
        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch2.id, { name: "Pantry" }),
        })

        const { body } = await request(app, "/api/location?q=Jakarta", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].name).toBe("Server Room")
        expect(body.data[0].branch.name).toBe("Jakarta Main")
    })

    test("should paginate results", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)

        for (let i = 0; i < 3; i++) {
            await request(app, "/api/location", {
                method: "POST",
                headers,
                body: createLocationData(branch.id),
            })
        }

        const { body } = await request(app, "/api/location?page=1&limit=2", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(2)
        expect(body.meta.total).toBe(3)
        expect(body.meta.currentPage).toBe(1)
        expect(body.meta.lastPage).toBe(2)
    })

    test("should sort locations by name or branch name", async () => {
        const { headers } = await registerAndLogin(app)
        
        const branchRes1 = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-A", name: "A Branch" }
        })
        const branch1 = branchRes1.body.data

        const branchRes2 = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-B", name: "B Branch" }
        })
        const branch2 = branchRes2.body.data

        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch2.id, { name: "Z Location" }), // B Branch
        })
        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch1.id, { name: "Y Location" }), // A Branch
        })

        // Sort by name ASC
        const resNameAsc = await request(app, "/api/location?sortBy=name&order=ASC", { method: "GET", headers })
        expect(resNameAsc.status).toBe(200)
        expect(resNameAsc.body.data[0].name).toBe("Y Location")
        expect(resNameAsc.body.data[1].name).toBe("Z Location")

        // Sort by branch name ASC
        const resBranchAsc = await request(app, "/api/location?sortBy=branch&order=ASC", { method: "GET", headers })
        expect(resBranchAsc.status).toBe(200)
        expect(resBranchAsc.body.data[0].branch.name).toBe("A Branch")
        expect(resBranchAsc.body.data[1].branch.name).toBe("B Branch")
    })

    test("should filter locations by branchId", async () => {
        const { headers } = await registerAndLogin(app)
        
        const branchRes1 = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-A", name: "Branch A" }
        })
        const branch1 = branchRes1.body.data

        const branchRes2 = await request(app, "/api/branch", {
            method: "POST",
            headers,
            body: { code: "BR-B", name: "Branch B" }
        })
        const branch2 = branchRes2.body.data

        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch1.id, { name: "Location A1" }),
        })
        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch1.id, { name: "Location A2" }),
        })
        await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch2.id, { name: "Location B1" }),
        })

        // Test filtering by query param
        const resQuery = await request(app, `/api/location?branchId=${branch1.id}`, { method: "GET", headers })
        expect(resQuery.status).toBe(200)
        expect(resQuery.body.data.length).toBe(2)
        expect(resQuery.body.data.every((loc: any) => loc.branch.id === branch1.id)).toBe(true)

        // Test filtering by custom route /location/by-branch/:branchId
        const resRoute = await request(app, `/api/location/by-branch/${branch1.id}`, { method: "GET", headers })
        expect(resRoute.status).toBe(200)
        expect(resRoute.body.success).toBe(true)
        expect(resRoute.body.data.length).toBe(2)
        expect(resRoute.body.data[0].name).toBe("Location A1")
        expect(resRoute.body.data[1].name).toBe("Location A2")
        expect(resRoute.body.data.every((loc: any) => loc.branch.id === branch1.id)).toBe(true)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/location/:id — Show
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/location/:id", () => {
    test("should return location by ID", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)
        const locationData = createLocationData(branch.id)

        const createRes = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: locationData,
        })
        const locationId = createRes.body.data.id

        const { status, body } = await request(app, `/api/location/${locationId}`, {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Location retrieved successfully")
        expect(body.data.id).toBe(locationId)
        expect(body.data.name).toBe(locationData.name)
        expect(body.data.description).toBe(locationData.description)
        expect(body.data.branch.id).toBe(branch.id)
        expect(body.data.branch.id).toBe(branch.id)
    })

    test("should return 404 for non-existent location", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/location/99999", {
            method: "GET",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Location not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/location/:id — Update
// ═══════════════════════════════════════════════════════════════════════════

describe("PUT /api/location/:id", () => {
    test("should update location details successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)

        const createRes = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id),
        })
        const locationId = createRes.body.data.id

        const { status, body } = await request(app, `/api/location/${locationId}`, {
            method: "PUT",
            headers,
            body: { name: "Updated Location", description: "Updated description" },
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Location updated successfully")
        expect(body.data.name).toBe("Updated Location")
        expect(body.data.description).toBe("Updated description")
    })

    test("should return 404 when updating non-existent location", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/location/99999", {
            method: "PUT",
            headers,
            body: { name: "Updated" },
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Location not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/location/:id — Destroy
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /api/location/:id", () => {
    test("should delete location successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const branch = await createTestBranch(app, headers)

        const createRes = await request(app, "/api/location", {
            method: "POST",
            headers,
            body: createLocationData(branch.id),
        })
        const locationId = createRes.body.data.id

        const { status, body } = await request(app, `/api/location/${locationId}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Location deleted successfully")

        // Verify it's deleted
        const { status: getStatus } = await request(app, `/api/location/${locationId}`, {
            method: "GET",
            headers,
        })
        expect(getStatus).toBe(404)
    })

    test("should return 404 when deleting non-existent location", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/location/99999", {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Location not found")
    })
})
