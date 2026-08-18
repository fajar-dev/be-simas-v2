import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { Hono } from "hono"
import {
    initTestDatabase,
    destroyTestDatabase,
    cleanTestDatabase,
    createTestApp,
    request,
    registerAndLogin,
} from "./setup"
import { flattenNusaworkOrganizations } from "../src/modules/organization/organization-tree"

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

// ═══════════════════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════════════════

describe("flattenNusaworkOrganizations", () => {
    test("dedupes a node that appears both top-level and nested under an ancestor", () => {
        const nodes = [
            {
                id: 1, pid: 0, name: "Networking", type: "department", description: null, is_active: true,
                childs: [
                    { id: 2, pid: 1, name: "Product Management", type: "division", description: null, is_active: true, childs: [] },
                ],
            },
            // Same node (id 2) repeated as a top-level entry, as the real API does.
            { id: 2, pid: 1, name: "Product Management", type: "division", description: null, is_active: true, childs: [] },
        ]

        const rows = flattenNusaworkOrganizations(nodes)
        expect(rows.length).toBe(2)
        const ids = rows.map((r) => r.id).sort()
        expect(ids).toEqual([1, 2])
    })

    test("maps pid 0 to a null parentId (root)", () => {
        const rows = flattenNusaworkOrganizations([
            { id: 1, pid: 0, name: "Root", type: "department", description: null, is_active: true, childs: [] },
        ])
        expect(rows[0]!.parentId).toBeNull()
    })

    test("maps a non-zero pid straight through", () => {
        const rows = flattenNusaworkOrganizations([
            { id: 2, pid: 1, name: "Child", type: "division", description: null, is_active: true, childs: [] },
        ])
        expect(rows[0]!.parentId).toBe(1)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

describe("Organization API", () => {
    test("GET /api/organization requires auth", async () => {
        const res = await request(app, "/api/organization")
        expect(res.status).toBe(401)
    })

    test("GET /api/organization/list requires auth", async () => {
        const res = await request(app, "/api/organization/list")
        expect(res.status).toBe(401)
    })

    test("creates a root organization", async () => {
        const { headers } = await registerAndLogin(app)
        const res = await request(app, "/api/organization", {
            method: "POST", headers,
            body: { name: "Networking", type: "department" },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.name).toBe("Networking")
        expect(res.body.data.parentId).toBeNull()
        expect(res.body.data.isActive).toBe(true)
    })

    test("creates a child organization under an existing parent", async () => {
        const { headers } = await registerAndLogin(app)
        const parent = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Networking", type: "department" } })
        const parentId = parent.body.data.id

        const res = await request(app, "/api/organization", {
            method: "POST", headers,
            body: { name: "Product Management", type: "division", parentId },
        })
        expect(res.status).toBe(201)
        expect(res.body.data.parentId).toBe(parentId)
        expect(res.body.data.parent).toEqual({ id: parentId, name: "Networking" })
    })

    test("rejects a child referencing a non-existent parent", async () => {
        const { headers } = await registerAndLogin(app)
        const res = await request(app, "/api/organization", {
            method: "POST", headers,
            body: { name: "Orphan", type: "division", parentId: 999999 },
        })
        expect(res.status).toBe(404)
    })

    test("rejects a missing name or type", async () => {
        const { headers } = await registerAndLogin(app)
        const noName = await request(app, "/api/organization", { method: "POST", headers, body: { type: "division" } })
        expect(noName.status).toBe(422)
        const noType = await request(app, "/api/organization", { method: "POST", headers, body: { name: "X" } })
        expect(noType.status).toBe(422)
    })

    test("GET /api/organization lists with pagination and shows the parent's name per row", async () => {
        const { headers } = await registerAndLogin(app)
        const parent = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Networking", type: "department" } })
        const parentId = parent.body.data.id
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Product Management", type: "division", parentId } })
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Sales & Marketing", type: "department" } })

        const res = await request(app, "/api/organization?page=1&limit=10", { headers })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(3)
        expect(res.body.meta.total).toBe(3)

        const child = res.body.data.find((o: any) => o.name === "Product Management")
        expect(child.parent).toEqual({ id: parentId, name: "Networking" })
    })

    test("GET /api/organization searches by name, type, or description", async () => {
        const { headers } = await registerAndLogin(app)
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Networking", type: "department" } })
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Sales", type: "division" } })

        const res = await request(app, "/api/organization?q=Networking", { headers })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(1)
        expect(res.body.data[0].name).toBe("Networking")
    })

    test("GET /api/organization sorts by name", async () => {
        const { headers } = await registerAndLogin(app)
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Zebra", type: "division" } })
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Alpha", type: "division" } })

        const res = await request(app, "/api/organization?sortBy=name&order=ASC", { headers })
        expect(res.body.data[0].name).toBe("Alpha")
        expect(res.body.data[1].name).toBe("Zebra")
    })

    test("GET /api/organization/list returns a flat, name-sorted list", async () => {
        const { headers } = await registerAndLogin(app)
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Zebra", type: "division" } })
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Alpha", type: "division" } })

        const res = await request(app, "/api/organization/list", { headers })
        expect(res.status).toBe(200)
        expect(res.body.data.map((o: any) => o.name)).toEqual(["Alpha", "Zebra"])
    })

    test("shows a single organization with its parent summary", async () => {
        const { headers } = await registerAndLogin(app)
        const parent = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Networking", type: "department" } })
        const child = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Product Management", type: "division", parentId: parent.body.data.id } })

        const res = await request(app, `/api/organization/${child.body.data.id}`, { headers })
        expect(res.status).toBe(200)
        expect(res.body.data.parent).toEqual({ id: parent.body.data.id, name: "Networking" })
    })

    test("returns 404 for a non-existent organization", async () => {
        const { headers } = await registerAndLogin(app)
        const res = await request(app, "/api/organization/999999", { headers })
        expect(res.status).toBe(404)
    })

    test("updates name, type, description, and isActive", async () => {
        const { headers } = await registerAndLogin(app)
        const created = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Old", type: "division" } })

        const res = await request(app, `/api/organization/${created.body.data.id}`, {
            method: "PUT", headers,
            body: { name: "New", type: "department", description: "Updated", isActive: false },
        })
        expect(res.status).toBe(200)
        expect(res.body.data.name).toBe("New")
        expect(res.body.data.type).toBe("department")
        expect(res.body.data.description).toBe("Updated")
        expect(res.body.data.isActive).toBe(false)
    })

    test("moves an organization under a new valid parent", async () => {
        const { headers } = await registerAndLogin(app)
        const a = await request(app, "/api/organization", { method: "POST", headers, body: { name: "A", type: "division" } })
        const b = await request(app, "/api/organization", { method: "POST", headers, body: { name: "B", type: "division" } })
        const child = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Child", type: "division", parentId: a.body.data.id } })

        const res = await request(app, `/api/organization/${child.body.data.id}`, { method: "PUT", headers, body: { parentId: b.body.data.id } })
        expect(res.status).toBe(200)
        expect(res.body.data.parentId).toBe(b.body.data.id)
        expect(res.body.data.parent).toEqual({ id: b.body.data.id, name: "B" })
    })

    test("rejects setting an organization as its own parent", async () => {
        const { headers } = await registerAndLogin(app)
        const created = await request(app, "/api/organization", { method: "POST", headers, body: { name: "A", type: "division" } })
        const res = await request(app, `/api/organization/${created.body.data.id}`, { method: "PUT", headers, body: { parentId: created.body.data.id } })
        expect(res.status).toBe(400)
    })

    test("rejects moving an organization under its own descendant", async () => {
        const { headers } = await registerAndLogin(app)
        const root = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Root", type: "division" } })
        const child = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Child", type: "division", parentId: root.body.data.id } })
        const grandchild = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Grandchild", type: "division", parentId: child.body.data.id } })

        // Root cannot be moved under its own grandchild.
        const res = await request(app, `/api/organization/${root.body.data.id}`, { method: "PUT", headers, body: { parentId: grandchild.body.data.id } })
        expect(res.status).toBe(400)
    })

    test("rejects updating with a non-existent parent", async () => {
        const { headers } = await registerAndLogin(app)
        const created = await request(app, "/api/organization", { method: "POST", headers, body: { name: "A", type: "division" } })
        const res = await request(app, `/api/organization/${created.body.data.id}`, { method: "PUT", headers, body: { parentId: 999999 } })
        expect(res.status).toBe(404)
    })

    test("deletes a leaf organization", async () => {
        const { headers } = await registerAndLogin(app)
        const created = await request(app, "/api/organization", { method: "POST", headers, body: { name: "A", type: "division" } })

        const res = await request(app, `/api/organization/${created.body.data.id}`, { method: "DELETE", headers })
        expect(res.status).toBe(200)

        const show = await request(app, `/api/organization/${created.body.data.id}`, { headers })
        expect(show.status).toBe(404)
    })

    test("blocks deleting an organization that still has children", async () => {
        const { headers } = await registerAndLogin(app)
        const parent = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Parent", type: "division" } })
        await request(app, "/api/organization", { method: "POST", headers, body: { name: "Child", type: "division", parentId: parent.body.data.id } })

        const res = await request(app, `/api/organization/${parent.body.data.id}`, { method: "DELETE", headers })
        expect(res.status).toBe(409)
    })

    test("blocks deleting an organization that is still an active asset holder", async () => {
        const { headers } = await registerAndLogin(app)
        const org = await request(app, "/api/organization", { method: "POST", headers, body: { name: "Holder Org", type: "division" } })

        const cat = await request(app, "/api/category", { method: "POST", headers, body: { name: "Cat Org Holder" } })
        const subCat = await request(app, "/api/sub-category", { method: "POST", headers, body: { name: "SubCat Org Holder", categoryId: cat.body.data.id } })
        const asset = await request(app, "/api/asset", { method: "POST", headers, body: { code: "AST-ORGHLD", name: "Shared Printer", subCategoryId: subCat.body.data.id } })

        await request(app, "/api/asset-holder", {
            method: "POST", headers,
            body: { assetId: asset.body.data.id, holderKind: "organization", organizationId: org.body.data.id, assignedDate: "2026-06-19" },
        })

        const res = await request(app, `/api/organization/${org.body.data.id}`, { method: "DELETE", headers })
        expect(res.status).toBe(409)
        expect(res.body.message).toContain("Cannot delete organization")
    })
})
