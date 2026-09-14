import { IQueueRepository } from "./interfaces/queue.repository.interface"
import { FailedJob } from "./entities/failed-job.entity"
import { NotFoundException } from "../../core/exceptions/base"

export type JobHandler = (payload: Record<string, any>) => Promise<void>

const MAX_ATTEMPTS = 3
/** Retry backoff in seconds, indexed by attempts already made. */
const BACKOFF_SECONDS = [5, 15, 45]

/** DB-backed job queue: `push()` is a fast INSERT (callers never wait on the job itself); `processNext()` runs one due job, called in a loop by the worker process (`bun run queue:work`). */
export class QueueService {
    private readonly handlers = new Map<string, JobHandler>()

    constructor(private readonly repository: IQueueRepository) {}

    registerHandler(jobType: string, handler: JobHandler): void {
        this.handlers.set(jobType, handler)
    }

    async push(jobType: string, payload: Record<string, any>, options?: { queue?: string; delaySeconds?: number }): Promise<void> {
        const queue = options?.queue || "default"
        const availableAt = new Date(Date.now() + (options?.delaySeconds ?? 0) * 1000)
        await this.repository.push(jobType, payload, queue, availableAt)
    }

    /** Runs one due job. Returns false only when the queue is empty. */
    async processNext(queue = "default"): Promise<boolean> {
        const job = await this.repository.reserveNext(queue)
        if (!job) return false

        try {
            const handler = this.handlers.get(job.jobType)
            if (!handler) throw new Error(`No handler registered for job type "${job.jobType}"`)
            await handler(job.payload)
            await this.repository.deleteJob(job.id)
        } catch (err) {
            const attempts = job.attempts + 1
            if (attempts >= MAX_ATTEMPTS) {
                const exception = err instanceof Error ? (err.stack || err.message) : String(err)
                await this.repository.moveToFailed(job, exception)
            } else {
                const delaySeconds = BACKOFF_SECONDS[attempts - 1] ?? 60
                await this.repository.release(job, new Date(Date.now() + delaySeconds * 1000))
            }
        }
        return true
    }

    async countPending(queue?: string): Promise<number> {
        return await this.repository.countPending(queue)
    }

    async getFailed(page: number, limit: number): Promise<{ data: FailedJob[]; total: number }> {
        return await this.repository.findAllFailed(page, limit)
    }

    async retryFailed(id: number): Promise<void> {
        const failedJob = await this.repository.findFailedById(id)
        if (!failedJob) throw new NotFoundException("Failed job not found")
        await this.repository.requeueFailed(failedJob)
    }

    async deleteFailed(id: number): Promise<void> {
        const failedJob = await this.repository.findFailedById(id)
        if (!failedJob) throw new NotFoundException("Failed job not found")
        await this.repository.deleteFailed(id)
    }
}
