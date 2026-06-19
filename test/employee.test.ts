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

let employeeCounter = 0

function createEmployeeData(overrides: Record<string, any> = {}) {
    employeeCounter++
    return {
        name: `Employee ${employeeCounter}`,
        employeeId: `EMP-${String(employeeCounter).padStart(3, "0")}`,
        jobPosition: "Software Engineer",
        email: `employee${employeeCounter}@example.com`,
        phone: `08123456${String(employeeCounter).padStart(4, "0")}`,
        ...overrides,
    }
}

// Reset employee counter in beforeEach
beforeEach(() => {
    employeeCounter = 0
})

// ═══════════════════════════════════════════════════════════════════════════
// Authentication Required — All employee routes need auth
// ═══════════════════════════════════════════════════════════════════════════

describe("Employee - Auth Required", () => {
    test("GET /api/employee should fail without auth", async () => {
        const { status, body } = await request(app, "/api/employee")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("POST /api/employee should fail without auth", async () => {
        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            body: createEmployeeData(),
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("GET /api/employee/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/employee/1")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("PUT /api/employee/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/employee/1", {
            method: "PUT",
            body: { name: "Updated" },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("DELETE /api/employee/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/employee/1", {
            method: "DELETE",
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/employee — Create
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/employee", () => {
    test("should create an employee successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const employeeData = createEmployeeData()

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: employeeData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Employee created successfully")
        expect(body.data).toBeDefined()
        expect(body.data.name).toBe(employeeData.name)
        expect(body.data.employeeId).toBe(employeeData.employeeId)
        expect(body.data.jobPosition).toBe(employeeData.jobPosition)
        expect(body.data.email).toBe(employeeData.email)
        expect(body.data.phone).toBe(employeeData.phone)
        expect(body.data.photo).toBeNull()
        expect(body.data.id).toBeDefined()
        expect(body.data.createdAt).toBeDefined()
        expect(body.data.updatedAt).toBeDefined()
    })

    test("should create an employee with photo", async () => {
        const { headers } = await registerAndLogin(app)
        const employeeData = createEmployeeData({ photo: "employees/photo.png" })

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: employeeData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.photo).toContain("employees/photo.png")
    })

    test("should fail validation without name", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: { employeeId: "EMP-001", jobPosition: "Dev", email: "test@example.com", phone: "081234" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation without employeeId", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: { name: "Test", jobPosition: "Dev", email: "test@example.com", phone: "081234" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation with invalid email", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: { name: "Test", employeeId: "EMP-001", jobPosition: "Dev", email: "not-an-email", phone: "081234" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })

    test("should fail validation without phone", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: { name: "Test", employeeId: "EMP-001", jobPosition: "Dev", email: "test@example.com" },
        })

        expect(status).toBe(422)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/employee — List
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/employee", () => {
    test("should return empty list initially", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Employees retrieved successfully")
        expect(body.data).toBeArray()
        expect(body.data.length).toBe(0)
        expect(body.meta).toBeDefined()
        expect(body.meta.total).toBe(0)
    })

    test("should return created employees", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData(),
        })
        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData(),
        })

        const { status, body } = await request(app, "/api/employee", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBe(2)
        expect(body.meta.total).toBe(2)
    })

    test("should search employees by name", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ name: "Alice Cooper" }),
        })
        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ name: "Bob Dylan" }),
        })

        const { body } = await request(app, "/api/employee?q=Cooper", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].name).toBe("Alice Cooper")
    })

    test("should search employees by employeeId", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ employeeId: "SPECIAL-001" }),
        })
        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ employeeId: "NORMAL-002" }),
        })

        const { body } = await request(app, "/api/employee?q=SPECIAL", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].employeeId).toBe("SPECIAL-001")
    })

    test("should paginate results", async () => {
        const { headers } = await registerAndLogin(app)

        for (let i = 0; i < 3; i++) {
            await request(app, "/api/employee", {
                method: "POST",
                headers,
                body: createEmployeeData(),
            })
        }

        const { body } = await request(app, "/api/employee?page=1&limit=2", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(2)
        expect(body.meta.total).toBe(3)
        expect(body.meta.currentPage).toBe(1)
        expect(body.meta.lastPage).toBe(2)
    })

    test("should sort employees by name or employeeId", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ name: "Charlie", employeeId: "EMP-003" }),
        })
        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ name: "Bob", employeeId: "EMP-002" }),
        })
        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ name: "Alice", employeeId: "EMP-001" }),
        })

        // Sort by name ASC
        const resNameAsc = await request(app, "/api/employee?sortBy=name&order=ASC", { method: "GET", headers })
        expect(resNameAsc.status).toBe(200)
        expect(resNameAsc.body.data[0].name).toBe("Alice")
        expect(resNameAsc.body.data[1].name).toBe("Bob")
        expect(resNameAsc.body.data[2].name).toBe("Charlie")

        // Sort by employeeId DESC
        const resIdDesc = await request(app, "/api/employee?sortBy=employeeId&order=DESC", { method: "GET", headers })
        expect(resIdDesc.status).toBe(200)
        expect(resIdDesc.body.data[0].employeeId).toBe("EMP-003")
        expect(resIdDesc.body.data[1].employeeId).toBe("EMP-002")
        expect(resIdDesc.body.data[2].employeeId).toBe("EMP-001")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/employee/:id — Show
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/employee/:id", () => {
    test("should return employee by ID", async () => {
        const { headers } = await registerAndLogin(app)
        const employeeData = createEmployeeData()

        const createRes = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: employeeData,
        })
        const employeeId = createRes.body.data.id

        const { status, body } = await request(app, `/api/employee/${employeeId}`, {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Employee retrieved successfully")
        expect(body.data.id).toBe(employeeId)
        expect(body.data.name).toBe(employeeData.name)
        expect(body.data.email).toBe(employeeData.email)
        expect(body.data.employeeId).toBe(employeeData.employeeId)
        expect(body.data.jobPosition).toBe(employeeData.jobPosition)
        expect(body.data.phone).toBe(employeeData.phone)
    })

    test("should return 404 for non-existent employee", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee/99999", {
            method: "GET",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Employee not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/employee/:id — Update
// ═══════════════════════════════════════════════════════════════════════════

describe("PUT /api/employee/:id", () => {
    test("should update employee details successfully", async () => {
        const { headers } = await registerAndLogin(app)

        const createRes = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData(),
        })
        const employeeId = createRes.body.data.id

        const { status, body } = await request(app, `/api/employee/${employeeId}`, {
            method: "PUT",
            headers,
            body: { name: "Updated Name", jobPosition: "Senior Engineer" },
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Employee updated successfully")
        expect(body.data.name).toBe("Updated Name")
        expect(body.data.jobPosition).toBe("Senior Engineer")
    })

    test("should return 404 when updating non-existent employee", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee/99999", {
            method: "PUT",
            headers,
            body: { name: "Updated" },
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Employee not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/employee/:id — Destroy
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /api/employee/:id", () => {
    test("should delete employee successfully", async () => {
        const { headers } = await registerAndLogin(app)

        const createRes = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData(),
        })
        const employeeId = createRes.body.data.id

        const { status, body } = await request(app, `/api/employee/${employeeId}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Employee deleted successfully")

        // Verify it's deleted
        const { status: getStatus } = await request(app, `/api/employee/${employeeId}`, {
            method: "GET",
            headers,
        })
        expect(getStatus).toBe(404)
    })

    test("should return 404 when deleting non-existent employee", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/employee/99999", {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Employee not found")
    })
})
