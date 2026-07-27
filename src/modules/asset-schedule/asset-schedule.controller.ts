import { Context } from "hono"
import { AssetScheduleService } from "./asset-schedule.service"
import { AssetScheduleSerializer } from "./serializers/asset-schedule.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"
import { AssetScheduleFilter } from "./interfaces/asset-schedule.repository.interface"

export class AssetScheduleController {
    constructor(private readonly service: AssetScheduleService) {}

    private parseFilters(c: Context): AssetScheduleFilter {
        const filters: AssetScheduleFilter = {}
        const assetId = c.req.query("assetId")
        const recurrence = c.req.query("recurrence")
        if (assetId) filters.assetId = Number(assetId)
        if (recurrence) filters.recurrence = recurrence
        return filters
    }

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order")?.toUpperCase() === "ASC" ? "ASC" : "DESC") as "ASC" | "DESC"

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, this.parseFilters(c))
        const serialized = await AssetScheduleSerializer.collection(data)
        return ApiResponse.paginate(c, serialized, total, page, limit, "Asset schedules retrieved successfully")
    }

    async calendar(c: Context) {
        const from = c.req.query("from")
        const to = c.req.query("to")
        if (!from || !to) {
            throw new BadRequestException("Query params 'from' and 'to' (YYYY-MM-DD) are required")
        }
        if (from > to) {
            throw new BadRequestException("'from' must be on or before 'to'")
        }

        const occurrences = await this.service.getCalendar(from, to, this.parseFilters(c))
        const data = await Promise.all(
            occurrences.map((o) => AssetScheduleSerializer.occurrence(o.schedule, o.date, o.isRecurring))
        )
        return ApiResponse.success(c, data, "Calendar retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const { schedule, attachments } = await this.service.getById(id)
        const data = await AssetScheduleSerializer.single(schedule, attachments)
        return ApiResponse.success(c, data, "Asset schedule retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const { schedule, attachments } = await this.service.create(body, user?.id)
        const data = await AssetScheduleSerializer.single(schedule, attachments)
        return ApiResponse.success(c, data, "Asset schedule created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const body = c.req.valid("json" as never) as any
        const { schedule, attachments } = await this.service.update(id, body)
        const data = await AssetScheduleSerializer.single(schedule, attachments)
        return ApiResponse.success(c, data, "Asset schedule updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "Asset schedule deleted successfully")
    }
}
