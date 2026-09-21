import { Job } from "../entities/job.entity"
import { FailedJob } from "../entities/failed-job.entity"

export interface IQueueRepository {
    push(jobType: string, payload: Record<string, any>, queue: string, availableAt: Date): Promise<Job>

    /** Atomically reserves the oldest available, unreserved job. */
    reserveNext(queue: string): Promise<Job | null>

    release(job: Job, availableAt: Date): Promise<void>
    deleteJob(id: number): Promise<void>
    moveToFailed(job: Job, exception: string): Promise<FailedJob>
    countPending(queue?: string): Promise<number>

    findAllFailed(page: number, limit: number): Promise<{ data: FailedJob[]; total: number }>
    findFailedById(id: number): Promise<FailedJob | null>
    deleteFailed(id: number): Promise<void>
    requeueFailed(failedJob: FailedJob): Promise<Job>
}
