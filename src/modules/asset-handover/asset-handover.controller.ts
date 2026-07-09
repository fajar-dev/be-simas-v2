import { Context } from "hono"
import { AssetHandoverService } from "./asset-handover.service"
import { AssetHandoverSerializer } from "./serializers/asset-handover.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class AssetHandoverController {
    constructor(private readonly service: AssetHandoverService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || "1")
        const limit = Number(c.req.query("limit") || "10")
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const status = c.req.query("status") || undefined
        const transactionType = c.req.query("transactionType") || undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, { status, transactionType })
        const serialized = await AssetHandoverSerializer.collection(data)

        return ApiResponse.paginate(c, serialized, total, page, limit, "Asset handovers retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const { handover, attachments } = await this.service.getById(id)
        const data = await AssetHandoverSerializer.single(handover, attachments)
        return ApiResponse.success(c, data, "Asset handover retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const { handover, attachments } = await this.service.create(body, user?.id)
        const data = await AssetHandoverSerializer.single(handover, attachments)
        return ApiResponse.success(c, data, "Asset handover created successfully", 201)
    }

    async cancel(c: Context) {
        const id = Number(c.req.param("id"))
        const { handover, attachments } = await this.service.cancel(id)
        const data = await AssetHandoverSerializer.single(handover, attachments)
        return ApiResponse.success(c, data, "Asset handover cancelled successfully")
    }
}
