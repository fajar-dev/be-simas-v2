import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test"
import { Hono } from "hono"
import {
    initTestDatabase,
    destroyTestDatabase,
    cleanTestDatabase,
    createTestApp,
    request,
    registerAndLogin,
    TestDataSource,
} from "./setup"
import { resetCounters } from "./helpers"
import { User } from "../src/modules/user/entities/user.entity"

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
        isActive: true,
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
        expect(body.data.isActive).toBe(true)
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

    test("should return 409 when deleting employee with linked users", async () => {
        const { headers } = await registerAndLogin(app)

        // Create an employee
        const createRes = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData(),
        })
        const empId = createRes.body.data.id

        // Link the test user to this employee
        const userRepo = TestDataSource.getRepository(User)
        await userRepo.update({ email: "test@example.com" }, { employeeId: empId })

        // Try to delete the employee
        const { status, body } = await request(app, `/api/employee/${empId}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.message).toContain("Cannot delete employee")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// Employee isActive Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Employee - isActive", () => {
    test("should create employee with isActive true by default", async () => {
        const { headers } = await registerAndLogin(app)
        const employeeData = createEmployeeData()
        delete (employeeData as any).isActive // remove explicit isActive to test default

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: employeeData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.isActive).toBe(true)
    })

    test("should create employee with isActive false", async () => {
        const { headers } = await registerAndLogin(app)
        const employeeData = createEmployeeData({ isActive: false })

        const { status, body } = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: employeeData,
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.data.isActive).toBe(false)
    })

    test("should update employee isActive status", async () => {
        const { headers } = await registerAndLogin(app)

        const createRes = await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData({ isActive: true }),
        })
        const employeeId = createRes.body.data.id
        expect(createRes.body.data.isActive).toBe(true)

        // Update to false
        const { status, body } = await request(app, `/api/employee/${employeeId}`, {
            method: "PUT",
            headers,
            body: { isActive: false },
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.isActive).toBe(false)

        // Verify by fetching
        const getRes = await request(app, `/api/employee/${employeeId}`, {
            method: "GET",
            headers,
        })
        expect(getRes.body.data.isActive).toBe(false)
    })

    test("should filter employees by isActive on paginated index", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Active1", isActive: true }) })
        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Active2", isActive: true }) })
        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Inactive1", isActive: false }) })

        // Filter active only
        const activeRes = await request(app, "/api/employee?isActive=true", { method: "GET", headers })
        expect(activeRes.status).toBe(200)
        expect(activeRes.body.data.length).toBe(2)
        expect(activeRes.body.data.every((e: any) => e.isActive === true)).toBe(true)

        // Filter inactive only
        const inactiveRes = await request(app, "/api/employee?isActive=false", { method: "GET", headers })
        expect(inactiveRes.status).toBe(200)
        expect(inactiveRes.body.data.length).toBe(1)
        expect(inactiveRes.body.data[0].name).toBe("Inactive1")

        // No filter = all
        const allRes = await request(app, "/api/employee", { method: "GET", headers })
        expect(allRes.status).toBe(200)
        expect(allRes.body.data.length).toBe(3)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/employee/list — List all (no pagination)
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/employee/list", () => {
    test("should return all employees without pagination", async () => {
        const { headers } = await registerAndLogin(app)

        for (let i = 0; i < 3; i++) {
            await request(app, "/api/employee", {
                method: "POST",
                headers,
                body: createEmployeeData(),
            })
        }

        const { status, body } = await request(app, "/api/employee/list", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data).toBeArrayOfSize(3)
        expect(body.meta).toBeUndefined()
    })

    test("should return only id, name, employeeId, photo fields", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/employee", {
            method: "POST",
            headers,
            body: createEmployeeData(),
        })

        const { status, body } = await request(app, "/api/employee/list", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.data.length).toBeGreaterThan(0)
        const item = body.data[0]
        expect(item.id).toBeDefined()
        expect(item.name).toBeDefined()
        expect(item.employeeId).toBeDefined()
        expect(item).toHaveProperty("photo")
        // Should NOT contain other fields
        expect(item.email).toBeUndefined()
        expect(item.phone).toBeUndefined()
        expect(item.jobPosition).toBeUndefined()
        expect(item.isActive).toBeUndefined()
        expect(item.createdAt).toBeUndefined()
    })

    test("should return employees sorted by name ASC", async () => {
        const { headers } = await registerAndLogin(app)

        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Zara" }) })
        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Andi" }) })
        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Maria" }) })

        const { body } = await request(app, "/api/employee/list", { method: "GET", headers })

        expect(body.data[0].name).toBe("Andi")
        expect(body.data[1].name).toBe("Maria")
        expect(body.data[2].name).toBe("Zara")
    })

    test("should filter by isActive query param", async () => {
        const { headers } = await registerAndLogin(app)

        // Create 2 active employees and 1 inactive
        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Active1" }) })
        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Active2" }) })
        await request(app, "/api/employee", { method: "POST", headers, body: createEmployeeData({ name: "Inactive", isActive: false }) })

        // Get only active
        const activeRes = await request(app, "/api/employee/list?isActive=true", { method: "GET", headers })
        expect(activeRes.status).toBe(200)
        expect(activeRes.body.data).toBeArrayOfSize(2)

        // Get only inactive
        const inactiveListRes = await request(app, "/api/employee/list?isActive=false", { method: "GET", headers })
        expect(inactiveListRes.status).toBe(200)
        expect(inactiveListRes.body.data).toBeArrayOfSize(1)

        // Get all (no filter)
        const allRes = await request(app, "/api/employee/list", { method: "GET", headers })
        expect(allRes.status).toBe(200)
        expect(allRes.body.data).toBeArrayOfSize(3)
    })

    test("should fail without auth", async () => {
        const { status } = await request(app, "/api/employee/list")
        expect(status).toBe(401)
    })
})

