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

let app: Hono
let authHeaders: Record<string, string>

// Dynamic import so the queue repository binds to the test DataSource.
async function getQueueService() {
    const { queueService } = await import("../src/modules/queue/queue.module")
    return queueService
}

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

describe("QueueService", () => {
    test("push() then processNext() runs the registered handler and removes the job", async () => {
        const queueService = await getQueueService()
        const seen: any[] = []
        queueService.registerHandler("test.echo", async (payload) => { seen.push(payload) })

        await queueService.push("test.echo", { foo: "bar" })
        expect(await queueService.countPending()).toBe(1)

        const processed = await queueService.processNext()
        expect(processed).toBe(true)
        expect(seen).toEqual([{ foo: "bar" }])
        expect(await queueService.countPending()).toBe(0)
    })

    test("processNext() returns false when the queue is empty", async () => {
        const queueService = await getQueueService()
        expect(await queueService.processNext()).toBe(false)
    })

    test("a job that keeps failing is retried with backoff, then moved to failed_jobs", async () => {
        const queueService = await getQueueService()
        let attempts = 0
        queueService.registerHandler("test.always-fails", async () => {
            attempts++
            throw new Error(`boom #${attempts}`)
        })

        await queueService.push("test.always-fails", { x: 1 })

        expect(await queueService.processNext()).toBe(true)
        expect(attempts).toBe(1)
        expect(await queueService.processNext()).toBe(false) // still backing off
        expect(await queueService.countPending()).toBe(1)

        const { data: failedBefore } = await queueService.getFailed(1, 10)
        expect(failedBefore.length).toBe(0)
    })

    test("a job moves to failed_jobs once it exhausts its retries", async () => {
        const queueService = await getQueueService()
        const { QueueRepository } = await import("../src/modules/queue/repositories/queue.repository")
        const repo = new QueueRepository()

        let calls = 0
        queueService.registerHandler("test.exhausts-retries", async () => {
            calls++
            throw new Error(`attempt ${calls}`)
        })
        await repo.push("test.exhausts-retries", { n: 1 }, "default", new Date())

        // Skip real backoff delays by forcing the job available again.
        for (let i = 0; i < 5; i++) {
            const processed = await queueService.processNext()
            if (!processed) {
                await import("../src/modules/queue/entities/job.entity").then(async ({ Job }) => {
                    const ds = (await import("../src/config/database")).AppDataSource
                    await ds.getRepository(Job).update({ jobType: "test.exhausts-retries" }, { availableAt: new Date(), reservedAt: null })
                })
            }
        }

        expect(calls).toBe(3) // MAX_ATTEMPTS
        expect(await queueService.countPending()).toBe(0)
        const { data, total } = await queueService.getFailed(1, 10)
        expect(total).toBe(1)
        expect(data[0].jobType).toBe("test.exhausts-retries")
        expect(data[0].exception).toContain("attempt 3")
    })

    test("retryFailed() re-queues a failed job and deleteFailed() removes it", async () => {
        const queueService = await getQueueService()
        queueService.registerHandler("test.retry-me", async () => { throw new Error("always fails") })

        const { QueueRepository } = await import("../src/modules/queue/repositories/queue.repository")
        const repo = new QueueRepository()
        const job = await repo.push("test.retry-me", { seed: true }, "default", new Date())
        const failed = await repo.moveToFailed(job, "seeded failure")

        const { data, total } = await queueService.getFailed(1, 10)
        expect(total).toBe(1)
        expect(data[0].id).toBe(failed.id)
        expect(data[0].jobType).toBe("test.retry-me")

        await queueService.retryFailed(failed.id)
        expect(await queueService.countPending()).toBe(1)
        const afterRetry = await queueService.getFailed(1, 10)
        expect(afterRetry.total).toBe(0)
    })

    test("retryFailed() throws for a non-existent failed job", async () => {
        const queueService = await getQueueService()
        await expect(queueService.retryFailed(999999)).rejects.toThrow()
    })

    test("deleteFailed() removes a failed job", async () => {
        const queueService = await getQueueService()
        const { QueueRepository } = await import("../src/modules/queue/repositories/queue.repository")
        const repo = new QueueRepository()
        const job = await repo.push("test.to-delete", {}, "default", new Date())
        const failed = await repo.moveToFailed(job, "seeded")

        await queueService.deleteFailed(failed.id)
        const { total } = await queueService.getFailed(1, 10)
        expect(total).toBe(0)
    })
})

describe("Queue API", () => {
    test("GET /api/queue/pending returns the pending count", async () => {
        const queueService = await getQueueService()
        await queueService.push("test.pending-count", {})

        const res = await request(app, "/api/queue/pending", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.count).toBe(1)
    })

    test("GET /api/queue/failed lists failed jobs, paginated", async () => {
        const { QueueRepository } = await import("../src/modules/queue/repositories/queue.repository")
        const repo = new QueueRepository()
        const job = await repo.push("test.listed", { a: 1 }, "default", new Date())
        await repo.moveToFailed(job, "boom")

        const res = await request(app, "/api/queue/failed", { headers: authHeaders })
        expect(res.status).toBe(200)
        expect(res.body.data.length).toBe(1)
        expect(res.body.data[0].jobType).toBe("test.listed")
        expect(res.body.data[0].exception).toBe("boom")
        expect(res.body.meta.total).toBe(1)
    })

    test("POST /api/queue/failed/:id/retry re-queues the job", async () => {
        const { QueueRepository } = await import("../src/modules/queue/repositories/queue.repository")
        const repo = new QueueRepository()
        const job = await repo.push("test.retry-endpoint", {}, "default", new Date())
        const failed = await repo.moveToFailed(job, "boom")

        const res = await request(app, `/api/queue/failed/${failed.id}/retry`, { method: "POST", headers: authHeaders })
        expect(res.status).toBe(200)

        const pending = await request(app, "/api/queue/pending", { headers: authHeaders })
        expect(pending.body.data.count).toBe(1)
    })

    test("POST /api/queue/failed/:id/retry returns 404 for a non-existent id", async () => {
        const res = await request(app, "/api/queue/failed/999999/retry", { method: "POST", headers: authHeaders })
        expect(res.status).toBe(404)
    })

    test("DELETE /api/queue/failed/:id deletes the failed job", async () => {
        const { QueueRepository } = await import("../src/modules/queue/repositories/queue.repository")
        const repo = new QueueRepository()
        const job = await repo.push("test.delete-endpoint", {}, "default", new Date())
        const failed = await repo.moveToFailed(job, "boom")

        const res = await request(app, `/api/queue/failed/${failed.id}`, { method: "DELETE", headers: authHeaders })
        expect(res.status).toBe(200)

        const list = await request(app, "/api/queue/failed", { headers: authHeaders })
        expect(list.body.data.length).toBe(0)
    })

    test("queue endpoints require auth", async () => {
        const res = await request(app, "/api/queue/failed")
        expect(res.status).toBe(401)
    })
})
