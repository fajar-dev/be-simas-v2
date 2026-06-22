import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
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
import { Role } from "../src/modules/role/entities/role.entity"
import { Permission } from "../src/modules/role/entities/permission.entity"
import { User } from "../src/modules/user/entities/user.entity"

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
})

// Helper to seed test permissions
async function seedPermissions(): Promise<Permission[]> {
    const permRepo = TestDataSource.getRepository(Permission)
    const perms = [
        { key: "test:read", module: "test", action: "read" },
        { key: "test:create", module: "test", action: "create" },
        { key: "test:update", module: "test", action: "update" },
        { key: "test:delete", module: "test", action: "delete" },
    ]
    return await permRepo.save(permRepo.create(perms))
}

// Helper to create a role
async function createRole(name: string, permissionIds: number[]): Promise<Role> {
    const roleRepo = TestDataSource.getRepository(Role)
    const permRepo = TestDataSource.getRepository(Permission)
    const permissions = await permRepo.findByIds(permissionIds)
    return await roleRepo.save(roleRepo.create({ name, permissions }))
}

// ═══════════════════════════════════════════════════════════════════════════
// Authentication Required
// ═══════════════════════════════════════════════════════════════════════════

describe("Role - Auth Required", () => {
    test("GET /api/role/permissions should fail without auth", async () => {
        const { status, body } = await request(app, "/api/role/permissions")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("GET /api/role should fail without auth", async () => {
        const { status, body } = await request(app, "/api/role")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("POST /api/role should fail without auth", async () => {
        const { status, body } = await request(app, "/api/role", {
            method: "POST",
            body: { name: "Test Role", permissionIds: [1] },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("GET /api/role/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/role/1")
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("PUT /api/role/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/role/1", {
            method: "PUT",
            body: { name: "Updated" },
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })

    test("DELETE /api/role/:id should fail without auth", async () => {
        const { status, body } = await request(app, "/api/role/1", {
            method: "DELETE",
        })
        expect(status).toBe(401)
        expect(body.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/role/permissions
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/role/permissions", () => {
    test("should return all permissions", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()

        const { status, body } = await request(app, "/api/role/permissions", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data).toBeArray()
        // Wait, setup also creates some default permissions if any?
        // But our seeded ones should be in the list
        expect(body.data.length).toBeGreaterThanOrEqual(seeded.length)
        const keys = body.data.map((p: any) => p.key)
        expect(keys).toContain("test:read")
        expect(keys).toContain("test:create")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/role
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/role", () => {
    test("should create a role successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const permissionIds = seeded.slice(0, 2).map(p => p.id)

        const { status, body } = await request(app, "/api/role", {
            method: "POST",
            headers,
            body: { name: "Staff Member", permissionIds },
        })

        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Role created successfully")
        expect(body.data).toBeDefined()
        expect(body.data.name).toBe("Staff Member")
        expect(body.data.isSuperAdmin).toBe(false)
        expect(body.data.permissions).toBeArray()
        expect(body.data.permissions.length).toBe(2)
        expect(body.data.permissions.map((p: any) => p.id)).toContain(permissionIds[0])
    })

    test("should fail validation without name or permissionIds", async () => {
        const { headers } = await registerAndLogin(app)

        const res1 = await request(app, "/api/role", {
            method: "POST",
            headers,
            body: { permissionIds: [1] },
        })
        expect(res1.status).toBe(422)

        const res2 = await request(app, "/api/role", {
            method: "POST",
            headers,
            body: { name: "Role Name", permissionIds: [] },
        })
        expect(res2.status).toBe(422)
    })

    test("should fail with duplicate name", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const permissionIds = [seeded[0].id]

        await request(app, "/api/role", {
            method: "POST",
            headers,
            body: { name: "Manager", permissionIds },
        })

        const { status, body } = await request(app, "/api/role", {
            method: "POST",
            headers,
            body: { name: "Manager", permissionIds },
        })

        expect(status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Role name already exists")
    })

    test("should fail if some permissionIds do not exist", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const permissionIds = [seeded[0].id, 99999] // 99999 is invalid

        const { status, body } = await request(app, "/api/role", {
            method: "POST",
            headers,
            body: { name: "Manager", permissionIds },
        })

        expect(status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Some permissions were not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/role — List
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/role", () => {
    test("should return all roles with pagination", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()

        await createRole("Role A", [seeded[0].id])
        await createRole("Role B", [seeded[1].id])

        const { status, body } = await request(app, "/api/role?page=1&limit=10", {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data).toBeArray()
        expect(body.data.length).toBeGreaterThanOrEqual(2)
        expect(body.meta).toBeDefined()
        expect(body.meta.total).toBeDefined()
    })

    test("should search roles by name", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()

        await createRole("Officer", [seeded[0].id])
        await createRole("Supervisor", [seeded[1].id])

        const { body } = await request(app, "/api/role?q=visor", {
            method: "GET",
            headers,
        })

        expect(body.data.length).toBe(1)
        expect(body.data[0].name).toBe("Supervisor")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/role/:id — Show
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/role/:id", () => {
    test("should return role by ID", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const role = await createRole("Sales", [seeded[0].id])

        const { status, body } = await request(app, `/api/role/${role.id}`, {
            method: "GET",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.id).toBe(role.id)
        expect(body.data.name).toBe("Sales")
        expect(body.data.permissions).toBeArray()
        expect(body.data.permissions[0].key).toBe("test:read")
    })

    test("should return 404 for non-existent role", async () => {
        const { headers } = await registerAndLogin(app)

        const { status, body } = await request(app, "/api/role/99999", {
            method: "GET",
            headers,
        })

        expect(status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Role not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/role/:id — Update
// ═══════════════════════════════════════════════════════════════════════════

describe("PUT /api/role/:id", () => {
    test("should update role details successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const role = await createRole("Tester", [seeded[0].id])

        const { status, body } = await request(app, `/api/role/${role.id}`, {
            method: "PUT",
            headers,
            body: { name: "Senior Tester", permissionIds: [seeded[0].id, seeded[1].id] },
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Role updated successfully")
        expect(body.data.name).toBe("Senior Tester")
        expect(body.data.permissions.length).toBe(2)
    })

    test("should fail with duplicate name", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const role1 = await createRole("Developer", [seeded[0].id])
        const role2 = await createRole("Lead Developer", [seeded[0].id])

        const { status, body } = await request(app, `/api/role/${role2.id}`, {
            method: "PUT",
            headers,
            body: { name: "Developer" },
        })

        expect(status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Role name already exists")
    })

    test("should fail if some permissionIds do not exist", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const role = await createRole("DevOps", [seeded[0].id])

        const { status, body } = await request(app, `/api/role/${role.id}`, {
            method: "PUT",
            headers,
            body: { permissionIds: [seeded[0].id, 99999] },
        })

        expect(status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Some permissions were not found")
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/role/:id — Destroy
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /api/role/:id", () => {
    test("should delete role successfully", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        const role = await createRole("Temp Role", [seeded[0].id])

        const { status, body } = await request(app, `/api/role/${role.id}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe("Role deleted successfully")

        // Verify deleted
        const checkRes = await request(app, `/api/role/${role.id}`, {
            method: "GET",
            headers,
        })
        expect(checkRes.status).toBe(404)
    })

    test("should return 400 when deleting Super Admin role", async () => {
        const { headers } = await registerAndLogin(app)
        const roleRepo = TestDataSource.getRepository(Role)
        const superAdmin = await roleRepo.findOne({ where: { name: "Super Admin" } })
        expect(superAdmin).toBeDefined()

        const { status, body } = await request(app, `/api/role/${superAdmin!.id}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.message).toBe("Cannot delete Super Admin role")
    })

    test("should return 400 when deleting role with assigned users", async () => {
        const { headers } = await registerAndLogin(app)
        const seeded = await seedPermissions()
        
        // Create a new role
        const role = await createRole("Assigned Role", [seeded[0].id])

        // Create a user and assign this role
        const userRepo = TestDataSource.getRepository(User)
        await userRepo.save(userRepo.create({
            name: "Assigned User",
            email: "assigned@example.com",
            password: "password123",
            roleId: role.id,
        }))

        // Try to delete the role
        const { status, body } = await request(app, `/api/role/${role.id}`, {
            method: "DELETE",
            headers,
        })

        expect(status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.message).toContain("Cannot delete role")
    })
})
