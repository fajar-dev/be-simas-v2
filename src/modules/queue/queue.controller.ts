import { Context } from "hono"
import { QueueService } from "./queue.service"
import { QueueSerializer } from "./serializers/queue.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class QueueController {
    constructor(private readonly service: QueueService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)

        const { data, total } = await this.service.getFailed(page, limit)

        return ApiResponse.paginate(c, QueueSerializer.collection(data), total, page, limit, "Failed jobs retrieved successfully")
    }

    async pending(c: Context) {
        const queue = c.req.query("queue") || undefined
        const count = await this.service.countPending(queue)
        return ApiResponse.success(c, { count }, "Pending job count retrieved successfully")
    }

    async retry(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.retryFailed(id)
        return ApiResponse.success(c, null, "Job re-queued successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.deleteFailed(id)
        return ApiResponse.success(c, null, "Failed job deleted successfully")
    }
}
