import { FailedJob } from "../entities/failed-job.entity"

export class QueueSerializer {
    static single(failedJob: FailedJob) {
        return {
            id: failedJob.id,
            uuid: failedJob.uuid,
            queue: failedJob.queue,
            jobType: failedJob.jobType,
            payload: failedJob.payload,
            exception: failedJob.exception,
            failedAt: failedJob.failedAt,
        }
    }

    static collection(failedJobs: FailedJob[]) {
        return failedJobs.map((failedJob) => this.single(failedJob))
    }
}
