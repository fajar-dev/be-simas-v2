import { Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Job } from "../entities/job.entity"
import { FailedJob } from "../entities/failed-job.entity"
import { IQueueRepository } from "../interfaces/queue.repository.interface"
import { withTransaction } from "../../../core/helpers/transaction"

export class QueueRepository implements IQueueRepository {
    private readonly repository: Repository<Job>
    private readonly failedRepository: Repository<FailedJob>

    constructor() {
        this.repository = AppDataSource.getRepository(Job)
        this.failedRepository = AppDataSource.getRepository(FailedJob)
    }

    async push(jobType: string, payload: Record<string, any>, queue: string, availableAt: Date): Promise<Job> {
        return await this.repository.save({
            queue,
            jobType,
            payload,
            attempts: 0,
            reservedAt: null,
            availableAt,
        })
    }

    async reserveNext(queue: string): Promise<Job | null> {
        const now = new Date()

        const candidate = await this.repository
            .createQueryBuilder("job")
            .where("job.queue = :queue", { queue })
            .andWhere("job.availableAt <= :now", { now })
            .andWhere("job.reservedAt IS NULL")
            .orderBy("job.id", "ASC")
            .limit(1)
            .getOne()

        if (!candidate) return null

        // Conditional update guards against another worker reserving the same row first.
        const result = await this.repository
            .createQueryBuilder()
            .update(Job)
            .set({ reservedAt: now })
            .where("id = :id", { id: candidate.id })
            .andWhere("reservedAt IS NULL")
            .execute()

        if (result.affected !== 1) return null

        candidate.reservedAt = now
        return candidate
    }

    async release(job: Job, availableAt: Date): Promise<void> {
        await this.repository.update(job.id, {
            attempts: job.attempts + 1,
            reservedAt: null,
            availableAt,
        })
    }

    async deleteJob(id: number): Promise<void> {
        await this.repository.delete(id)
    }

    async moveToFailed(job: Job, exception: string): Promise<FailedJob> {
        return await withTransaction(async (manager) => {
            const failedJob = await manager.getRepository(FailedJob).save({
                uuid: crypto.randomUUID(),
                queue: job.queue,
                jobType: job.jobType,
                payload: job.payload,
                exception,
            })
            await manager.getRepository(Job).delete(job.id)
            return failedJob
        })
    }

    async countPending(queue?: string): Promise<number> {
        return await this.repository.count(queue ? { where: { queue } } : {})
    }

    async findAllFailed(page: number, limit: number): Promise<{ data: FailedJob[]; total: number }> {
        const [data, total] = await this.failedRepository.findAndCount({
            order: { id: "DESC" },
            skip: (page - 1) * limit,
            take: limit,
        })
        return { data, total }
    }

    async findFailedById(id: number): Promise<FailedJob | null> {
        return await this.failedRepository.findOneBy({ id })
    }

    async deleteFailed(id: number): Promise<void> {
        await this.failedRepository.delete(id)
    }

    async requeueFailed(failedJob: FailedJob): Promise<Job> {
        return await withTransaction(async (manager) => {
            const job = await manager.getRepository(Job).save({
                queue: failedJob.queue,
                jobType: failedJob.jobType,
                payload: failedJob.payload,
                attempts: 0,
                reservedAt: null,
                availableAt: new Date(),
            })
            await manager.getRepository(FailedJob).delete(failedJob.id)
            return job
        })
    }
}
