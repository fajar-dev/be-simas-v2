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
let subCategoryId: number
let employeeId: number
let locationId: number

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

    // Create Category and SubCategory
    const catRes = await request(app, "/api/category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "CAT-LOG", name: "Log Category" },
    })
    const subRes = await request(app, "/api/sub-category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "SUB-LOG", name: "Log SubCategory", categoryId: catRes.body.data.id },
    })
    subCategoryId = subRes.body.data.id

    // Create Employee
    const empRes = await request(app, "/api/employee", {
        method: "POST",
        headers: authHeaders,
        body: { 
            employeeId: "EMP-LOG-1", 
            name: "John Log Doe", 
            email: "john.log@example.com",
            phone: "08123456789",
            jobPosition: "QA Engineer"
        },
    })
    employeeId = empRes.body.data.id

    // Create Branch & Location
    const branchRes = await request(app, "/api/branch", {
        method: "POST",
        headers: authHeaders,
        body: { code: "BR-LOG", name: "Log Branch" },
    })
    const locRes = await request(app, "/api/location", {
        method: "POST",
        headers: authHeaders,
        body: { name: "Log Location", branchId: branchRes.body.data.id },
    })
    locationId = locRes.body.data.id
})

describe("Asset Log API & Lifecycle Tests", () => {
    test("Asset creation, updating, assign, return, relocation, and maintenance operations generate correct logs", async () => {
        // 1. Create Asset (without assignment/location)
        const createAssetRes = await request(app, "/api/asset", {
            method: "POST",
            headers: authHeaders,
            body: {
                code: "AST-LOG-101",
                name: "Log Test Asset",
                subCategoryId,
                price: 15000000,
                brand: "Dell",
                model: "Lattitude",
                description: "Initial description",
            },
        })
        expect(createAssetRes.status).toBe(201)
        const assetId = createAssetRes.body.data.id

        // 2. Fetch logs and verify 'create' log
        let logsRes = await request(app, `/api/asset-log?assetId=${assetId}`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.status).toBe(200)
        expect(logsRes.body.data.length).toBe(1)
        expect(logsRes.body.data[0].action).toBe("create")
        expect(logsRes.body.data[0].description).toContain('Asset "Log Test Asset" (AST-LOG-101) was registered.')
        expect(logsRes.body.data[0].createdBy.name).toBe("Test User")

        // 3. Update Asset and verify 'update' log
        const updateAssetRes = await request(app, `/api/asset/${assetId}`, {
            method: "PUT",
            headers: authHeaders,
            body: {
                name: "Log Test Asset Revised",
                price: 18000000,
                description: "Updated description",
            },
        })
        expect(updateAssetRes.status).toBe(200)

        logsRes = await request(app, `/api/asset-log?assetId=${assetId}&sortBy=createdAt&order=ASC`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.body.data.length).toBe(2)
        expect(logsRes.body.data[1].action).toBe("update")
        expect(logsRes.body.data[1].description).toContain('Name changed from "Log Test Asset" to "Log Test Asset Revised"')
        expect(logsRes.body.data[1].description).toContain('Price changed from "15000000" to "18000000"')
        expect(logsRes.body.data[1].description).toContain('Description updated')

        // 4. Assign Asset and verify 'assign' log
        const assignRes = await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetId,
                employeeId,
                assignedDate: "2026-06-20",
                assignNote: "Assigning to John for audit testing",
            },
        })
        expect(assignRes.status).toBe(201)
        const holderId = assignRes.body.data.id

        logsRes = await request(app, `/api/asset-log?assetId=${assetId}&sortBy=createdAt&order=ASC`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.body.data.length).toBe(3)
        expect(logsRes.body.data[2].action).toBe("assign")
        expect(logsRes.body.data[2].description).toContain('Asset assigned to employee "John Log Doe"')

        // 5. Return Asset and verify 'return' log
        const returnRes = await request(app, `/api/asset-holder/${holderId}/return`, {
            method: "POST",
            headers: authHeaders,
            body: {
                returnedDate: "2026-06-21",
                returnNote: "Asset returned in pristine condition",
            },
        })
        expect(returnRes.status).toBe(200)

        logsRes = await request(app, `/api/asset-log?assetId=${assetId}&sortBy=createdAt&order=ASC`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.body.data.length).toBe(4)
        expect(logsRes.body.data[3].action).toBe("return")
        expect(logsRes.body.data[3].description).toContain('Asset returned from employee "John Log Doe"')

        // 6. Move/Relocate Asset and verify 'relocate' log
        const relocateRes = await request(app, "/api/asset-location", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetId,
                locationId,
                date: "2026-06-20",
                note: "Moving to Log Location Room",
            },
        })
        expect(relocateRes.status).toBe(201)

        logsRes = await request(app, `/api/asset-log?assetId=${assetId}&sortBy=createdAt&order=ASC`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.body.data.length).toBe(5)
        expect(logsRes.body.data[4].action).toBe("relocate")
        expect(logsRes.body.data[4].description).toContain('Asset location moved to "Log Location"')

        // 7. Create Maintenance and verify 'maintenance_create' log
        const maintCreateRes = await request(app, "/api/asset-maintenance", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetId,
                date: "2026-06-20",
                note: "Screen replacement",
            },
        })
        expect(maintCreateRes.status).toBe(201)
        const maintenanceId = maintCreateRes.body.data.id

        logsRes = await request(app, `/api/asset-log?assetId=${assetId}&sortBy=createdAt&order=ASC`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.body.data.length).toBe(6)
        expect(logsRes.body.data[5].action).toBe("maintenance_create")
        expect(logsRes.body.data[5].description).toContain('Maintenance recorded: Screen replacement')

        // 8. Update Maintenance and verify 'maintenance_update' log
        const maintUpdateRes = await request(app, `/api/asset-maintenance/${maintenanceId}`, {
            method: "PUT",
            headers: authHeaders,
            body: {
                assetId,
                date: "2026-06-20",
                note: "Screen replacement & Keyboard cleaning",
            },
        })
        expect(maintUpdateRes.status).toBe(200)

        logsRes = await request(app, `/api/asset-log?assetId=${assetId}&sortBy=createdAt&order=ASC`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.body.data.length).toBe(7)
        expect(logsRes.body.data[6].action).toBe("maintenance_update")
        expect(logsRes.body.data[6].description).toContain('Maintenance record updated: Screen replacement & Keyboard cleaning')

        // 9. Delete Maintenance and verify 'maintenance_delete' log
        const maintDeleteRes = await request(app, `/api/asset-maintenance/${maintenanceId}`, {
            method: "DELETE",
            headers: authHeaders,
        })
        expect(maintDeleteRes.status).toBe(200)

        logsRes = await request(app, `/api/asset-log?assetId=${assetId}&sortBy=createdAt&order=ASC`, {
            method: "GET",
            headers: authHeaders,
        })
        expect(logsRes.body.data.length).toBe(8)
        expect(logsRes.body.data[7].action).toBe("maintenance_delete")
        expect(logsRes.body.data[7].description).toContain('Maintenance record was deleted (Note: "Screen replacement & Keyboard cleaning")')
    })
})
