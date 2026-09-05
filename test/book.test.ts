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
import { User } from "../src/modules/user/entities/user.entity"

// ── Mock MinIO ──────────────────────────────────────────────────────────────
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

// GET /book/loan is protected by the API key middleware (x-api-key), not bearer auth.
// In tests, config falls back to the dev key when API_KEY env is empty.
const apiKeyHeaders = { "x-api-key": "dev-api-key-change-me" }

let app: Hono
let authHeaders: Record<string, string>
let bookAssetId: number
let nonBookAssetId: number
let employeeId: number

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

    // Create employee and link to user
    const empRes = await request(app, "/api/employee", {
        method: "POST",
        headers: authHeaders,
        body: {
            employeeId: "EMP-BOOK-01",
            name: "Book Reader",
            jobPosition: "Librarian",
            email: "reader@book.com",
            phone: "08111111111"
        }
    })
    employeeId = empRes.body.data.id

    // Link user to employee
    const userRepo = TestDataSource.getRepository(User)
    await userRepo.update({ email: "test@example.com" }, { employeeId })

    // Create "Buku" category + sub-category
    const bookCatRes = await request(app, "/api/category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "CAT-BOOK", name: "Buku" },
    })
    const bookSubRes = await request(app, "/api/sub-category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "SUB-NOVEL", name: "Novel", categoryId: bookCatRes.body.data.id },
    })

    // Create a non-book category
    const otherCatRes = await request(app, "/api/category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "CAT-IT", name: "IT Equipment" },
    })
    const otherSubRes = await request(app, "/api/sub-category", {
        method: "POST",
        headers: authHeaders,
        body: { code: "SUB-LAPTOP", name: "Laptop", categoryId: otherCatRes.body.data.id },
    })

    // Create book asset (hasHolder = true)
    const bookRes = await request(app, "/api/asset", {
        method: "POST",
        headers: authHeaders,
        body: { code: "BOOK-001", name: "Atomic Habits", subCategoryId: bookSubRes.body.data.id, hasHolder: true },
    })
    bookAssetId = bookRes.body.data.id

    // Set asset status to active
    await request(app, "/api/asset-status", {
        method: "POST",
        headers: authHeaders,
        body: { assetId: bookAssetId, status: "active", note: "Ready" },
    })

    // Create non-book asset
    const nonBookRes = await request(app, "/api/asset", {
        method: "POST",
        headers: authHeaders,
        body: { code: "LAPTOP-001", name: "MacBook Pro", subCategoryId: otherSubRes.body.data.id },
    })
    nonBookAssetId = nonBookRes.body.data.id
})

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/book/borrow
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/book/borrow", () => {
    test("should borrow a book successfully", async () => {
        const res = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId, assignNote: "For reading club" },
        })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.message).toBe("Book borrowed successfully")
        expect(res.body.data.asset.id).toBe(bookAssetId)
        expect(res.body.data.employee.id).toBe(employeeId)
        expect(res.body.data.assignNote).toBe("For reading club")
        expect(res.body.data.returnedDate).toBeNull()
    })

    test("should fail if asset is not a book category", async () => {
        // Set non-book asset status to active
        await request(app, "/api/asset-status", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: nonBookAssetId, status: "active" },
        })

        const res = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: nonBookAssetId },
        })

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
        expect(res.body.message).toContain("not a book")
    })

    test("should fail if book is not in active status", async () => {
        // Set status to disposed
        await request(app, "/api/asset-status", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId, status: "disposed", note: "Damaged" },
        })

        const res = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
        expect(res.body.message).toContain("not in active status")
    })

    test("should fail if book is already borrowed", async () => {
        // Borrow first
        await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        // Try to borrow again
        const res = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
    })

    test("should fail without auth", async () => {
        const res = await request(app, "/api/book/borrow", {
            method: "POST",
            body: { assetId: bookAssetId },
        })

        expect(res.status).toBe(401)
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/book/return
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/book/return", () => {
    test("should return a book successfully", async () => {
        // Borrow first
        const borrowRes = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })
        const holderId = borrowRes.body.data.id

        // Return
        const res = await request(app, "/api/book/return", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetHolderId: holderId,
                returnNote: "https://www.goodreads.com/book/show/40121378",
            },
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.message).toBe("Book returned successfully")
        expect(res.body.data.returnedDate).toBeTruthy()
        expect(res.body.data.returnNote).toBe("https://www.goodreads.com/book/show/40121378")
    })

    test("should fail if returnNote is not a valid URL", async () => {
        const borrowRes = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })
        const holderId = borrowRes.body.data.id

        const res = await request(app, "/api/book/return", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetHolderId: holderId,
                returnNote: "not a url",
            },
        })

        expect(res.status).toBe(422)
        expect(res.body.success).toBe(false)
    })

    test("should fail if returnNote is missing", async () => {
        const borrowRes = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })
        const holderId = borrowRes.body.data.id

        const res = await request(app, "/api/book/return", {
            method: "POST",
            headers: authHeaders,
            body: { assetHolderId: holderId },
        })

        expect(res.status).toBe(422)
        expect(res.body.success).toBe(false)
    })

    test("should fail to return already returned book", async () => {
        const borrowRes = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })
        const holderId = borrowRes.body.data.id

        // Return once
        await request(app, "/api/book/return", {
            method: "POST",
            headers: authHeaders,
            body: { assetHolderId: holderId, returnNote: "https://goodreads.com/book/1" },
        })

        // Return again
        const res = await request(app, "/api/book/return", {
            method: "POST",
            headers: authHeaders,
            body: { assetHolderId: holderId, returnNote: "https://goodreads.com/book/1" },
        })

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/book/loan
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/book/loan", () => {
    test("should return an array with an empty employee map when no loans", async () => {
        const res = await request(app, "/api/book/loan", {
            method: "GET",
            headers: apiKeyHeaders,
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.message).toBe("Loans retrieved successfully")
        expect(res.body.data).toBeArray()
        expect(res.body.data.length).toBe(1)
        expect(res.body.data[0]).toEqual({})
    })

    test("should group loans by employee with book loan details", async () => {
        // Borrow a book
        await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId, assignNote: "For reading club" },
        })

        const res = await request(app, "/api/book/loan", {
            method: "GET",
            headers: apiKeyHeaders,
        })

        expect(res.status).toBe(200)
        const employeeLoans = res.body.data[0]
        expect(employeeLoans["EMP-BOOK-01"]).toBeDefined()
        expect(employeeLoans["EMP-BOOK-01"].employee).toBe("Book Reader")

        const bookLoans = employeeLoans["EMP-BOOK-01"].bookLoans
        const loanKeys = Object.keys(bookLoans)
        expect(loanKeys.length).toBe(1)

        const loan = bookLoans[loanKeys[0]]
        expect(loan.code).toBe("BOOK-001")
        expect(loan.name).toBe("Atomic Habits")
        expect(loan.subCategory).toBe("Novel")
        expect(loan.loanHistory.loaning.loanPeriod).toBeTruthy()
        expect(loan.loanHistory.return.returnTime).toBeNull()
        expect(loan.loanHistory.return.linkReview).toBeNull()
    })

    test("should include review link and return time after a book is returned", async () => {
        const borrowRes = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        await request(app, "/api/book/return", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetHolderId: borrowRes.body.data.id,
                returnNote: "https://www.goodreads.com/book/show/40121378",
            },
        })

        const res = await request(app, "/api/book/loan", {
            method: "GET",
            headers: apiKeyHeaders,
        })

        const bookLoans = res.body.data[0]["EMP-BOOK-01"].bookLoans
        const loan = bookLoans[Object.keys(bookLoans)[0]]
        expect(loan.loanHistory.return.returnTime).toBeTruthy()
        expect(loan.loanHistory.return.linkReview).toBe("https://www.goodreads.com/book/show/40121378")
    })

    test("should filter by hasReturn=false (only active loans)", async () => {
        await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        const res = await request(app, "/api/book/loan?hasReturn=false", {
            method: "GET",
            headers: apiKeyHeaders,
        })

        const bookLoans = res.body.data[0]["EMP-BOOK-01"].bookLoans
        expect(Object.keys(bookLoans).length).toBe(1)

        const returnedRes = await request(app, "/api/book/loan?hasReturn=true", {
            method: "GET",
            headers: apiKeyHeaders,
        })
        expect(returnedRes.body.data[0]).toEqual({})
    })

    test("should filter by search term", async () => {
        await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        const match = await request(app, "/api/book/loan?search=Atomic", {
            method: "GET",
            headers: apiKeyHeaders,
        })
        expect(match.body.data[0]["EMP-BOOK-01"]).toBeDefined()

        const noMatch = await request(app, "/api/book/loan?search=Nonexistent", {
            method: "GET",
            headers: apiKeyHeaders,
        })
        expect(noMatch.body.data[0]).toEqual({})
    })

    test("should not include non-book category loans", async () => {
        // Activate and borrow-like assign the non-book asset directly via asset-holder
        await request(app, "/api/asset-status", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: nonBookAssetId, status: "active" },
        })
        await request(app, "/api/asset-holder", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: nonBookAssetId, employeeId, assignedDate: "2026-07-07T10:00" },
        })

        const res = await request(app, "/api/book/loan", {
            method: "GET",
            headers: apiKeyHeaders,
        })

        expect(res.status).toBe(200)
        expect(res.body.data[0]).toEqual({})
    })

    test("should fail without api key", async () => {
        const res = await request(app, "/api/book/loan", { method: "GET" })
        expect(res.status).toBe(401)
    })

    test("should fail with an invalid api key", async () => {
        const res = await request(app, "/api/book/loan", {
            method: "GET",
            headers: { "x-api-key": "wrong-key" },
        })
        expect(res.status).toBe(401)
    })

    test("should reject bearer token (api key required, not auth)", async () => {
        const res = await request(app, "/api/book/loan", {
            method: "GET",
            headers: authHeaders,
        })
        expect(res.status).toBe(401)
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/book/my-books
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/book/my-books", () => {
    test("should return empty list when no books borrowed", async () => {
        const res = await request(app, "/api/book/my-books", {
            method: "GET",
            headers: authHeaders,
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data).toBeArray()
        expect(res.body.data.length).toBe(0)
    })

    test("should return borrowed books", async () => {
        // Borrow a book
        await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        const res = await request(app, "/api/book/my-books", {
            method: "GET",
            headers: authHeaders,
        })

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(1)
        expect(res.body.data[0].asset.id).toBe(bookAssetId)
        expect(res.body.data[0].returnedDate).toBeNull()
    })

    test("should not include returned books", async () => {
        // Borrow then return
        const borrowRes = await request(app, "/api/book/borrow", {
            method: "POST",
            headers: authHeaders,
            body: { assetId: bookAssetId },
        })

        await request(app, "/api/book/return", {
            method: "POST",
            headers: authHeaders,
            body: {
                assetHolderId: borrowRes.body.data.id,
                returnNote: "https://goodreads.com/book/123",
            },
        })

        const res = await request(app, "/api/book/my-books", {
            method: "GET",
            headers: authHeaders,
        })

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(0)
    })

    test("should fail without auth", async () => {
        const res = await request(app, "/api/book/my-books", { method: "GET" })
        expect(res.status).toBe(401)
    })
})
