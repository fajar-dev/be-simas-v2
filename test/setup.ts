import "reflect-metadata"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { DataSource } from "typeorm"
import { User } from "../src/modules/user/entities/user.entity"
import { Role } from "../src/modules/role/entities/role.entity"
import { Permission } from "../src/modules/role/entities/permission.entity"
import { Category } from "../src/modules/category/entities/category.entity"
import { SubCategory } from "../src/modules/sub-category/entities/sub-category.entity"
import { Employee } from "../src/modules/employee/entities/employee.entity"
import { Branch } from "../src/modules/branch/entities/branch.entity"
import { Location } from "../src/modules/location/entities/location.entity"
import { Asset } from "../src/modules/asset/entities/asset.entity"
import { AssetLabel } from "../src/modules/asset/entities/asset-label.entity"
import { Attachment } from "../src/modules/attachment/entities/attachment.entity"
import { AssetMaintenance } from "../src/modules/asset-maintenance/entities/asset-maintenance.entity"
import { AssetNote } from "../src/modules/asset-note/entities/asset-note.entity"
import { AssetLocation } from "../src/modules/asset-location/entities/asset-location.entity"
import { AssetHolder } from "../src/modules/asset-holder/entities/asset-holder.entity"
import { AssetLog } from "../src/modules/asset-log/entities/asset-log.entity"
import { AssetStatus } from "../src/modules/asset-status/entities/asset-status.entity"
import { ApiResponse } from "../src/core/helpers/response"
import { BaseException, ValidationException } from "../src/core/exceptions/base"
import { ZodError } from "zod"
import { config } from "../src/config/config"
import { setDataSource } from "../src/config/database"

// ── Test Database ───────────────────────────────────────────────────────────
// Uses real database with a separate test database name
// Ensure DB_TEST_NAME database exists before running tests

const testDbName = process.env.DB_TEST_NAME || "simas_test"
const dbType = (process.env.DB_TYPE || config.database.type) as "postgres" | "mysql"

const TestDataSource = new DataSource({
    type: dbType,
    host: config.database.host,
    port: config.database.port,
    username: config.database.user,
    password: config.database.pass,
    database: testDbName,
    synchronize: true,
    dropSchema: true,
    entities: [User, Role, Permission, Category, SubCategory, Employee, Branch, Location, Asset, AssetLabel, Attachment, AssetMaintenance, AssetNote, AssetLocation, AssetHolder, AssetLog, AssetStatus],
    logging: false,
})

// ── Database Lifecycle ──────────────────────────────────────────────────────

export async function initTestDatabase() {
    if (!TestDataSource.isInitialized) {
        await TestDataSource.initialize()
    }
    // Override the global AppDataSource so all modules use TestDataSource
    setDataSource(TestDataSource)
}

export async function destroyTestDatabase() {
    if (TestDataSource.isInitialized) {
        await TestDataSource.destroy()
    }
}

export async function cleanTestDatabase() {
    if (!TestDataSource.isInitialized) return

    const queryRunner = TestDataSource.createQueryRunner()
    try {
        if (dbType === "postgres") {
            await queryRunner.query("SET session_replication_role = 'replica'")
        } else {
            await queryRunner.query("SET FOREIGN_KEY_CHECKS = 0")
        }

        const entities = TestDataSource.entityMetadatas
        for (const entity of entities) {
            const quote = dbType === "postgres" ? '"' : '`'
            await queryRunner.query(`DELETE FROM ${quote}${entity.tableName}${quote}`)
        }

        if (dbType === "postgres") {
            await queryRunner.query("SET session_replication_role = 'origin'")
        } else {
            await queryRunner.query("SET FOREIGN_KEY_CHECKS = 1")
        }
    } finally {
        await queryRunner.release()
    }
}

// ── Test App Factory ────────────────────────────────────────────────────────

/**
 * Creates a fresh Hono app with all routes, using TestDataSource.
 * Must be called AFTER initTestDatabase().
 */
export function createTestApp(): Hono {
    // Import routes — they use AppDataSource which is now TestDataSource
    const api = require("../src/routes/api").default

    const app = new Hono()

    app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }))
    app.route("/api", api)

    // Global Error Handler (matches production)
    app.onError((err, c) => {
        if (err instanceof ZodError) {
            const valErr = new ValidationException(err)
            return ApiResponse.error(c, valErr.message, valErr.status, valErr.context)
        }

        if (err instanceof BaseException) {
            return ApiResponse.error(c, err.message, err.status, err.context)
        }

        return ApiResponse.error(c, "Internal Server Error", 500, {
            message: err.message,
            stack: err.stack,
        })
    })

    return app
}

// ── Request Helper ──────────────────────────────────────────────────────────

interface RequestOptions {
    method?: string
    headers?: Record<string, string>
    body?: any
}

export async function request(app: Hono, path: string, options: RequestOptions = {}) {
    const { method = "GET", headers = {}, body } = options

    const init: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", ...headers },
    }

    if (body) {
        init.body = JSON.stringify(body)
    }

    const res = await app.request(path, init)
    const json = await res.json() as any

    return { status: res.status, body: json }
}

// ── Auth Helper ─────────────────────────────────────────────────────────────

export async function registerAndLogin(
    app: Hono,
    userData = { name: "Test User", email: "test@example.com", password: "password123" }
) {
    // Register
    const regRes = await request(app, "/api/auth/register", { method: "POST", body: userData })
    if (!regRes.body.success) {
        throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`)
    }

    // Create super admin role with all permissions for tests
    const roleRepo = TestDataSource.getRepository(Role)
    let superAdmin = await roleRepo.findOne({ where: { name: 'Super Admin' } })
    if (!superAdmin) {
        superAdmin = roleRepo.create({ name: 'Super Admin', isSuperAdmin: true, permissions: [] })
        await roleRepo.save(superAdmin)
    }

    // Assign role to user
    const userRepo = TestDataSource.getRepository(User)
    await userRepo.update({ email: userData.email }, { roleId: superAdmin.id })

    // Login
    const loginRes = await request(app, "/api/auth/login", {
        method: "POST",
        body: { email: userData.email, password: userData.password },
    })
    if (!loginRes.body.success) {
        throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`)
    }

    return {
        accessToken: loginRes.body.data.accessToken,
        refreshToken: loginRes.body.data.refreshToken,
        headers: { Authorization: `Bearer ${loginRes.body.data.accessToken}` },
        user: loginRes.body.data.user,
    }
}

export { TestDataSource }
