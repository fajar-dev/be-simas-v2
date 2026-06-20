import { Context } from "hono"
import { AssetLocationService } from "./asset-location.service"
import { AssetLocationSerializer } from "./serializers/asset-location.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class AssetLocationController {
    constructor(private readonly service: AssetLocationService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || "1")
        const limit = Number(c.req.query("limit") || "10")
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || ""
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const assetIdVal = c.req.query("assetId")
        const assetId = assetIdVal ? Number(assetIdVal) : undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, assetId)
        const serialized = await AssetLocationSerializer.collection(data)

        return ApiResponse.success(c, serialized, "Asset location history retrieved successfully", 200, {
            total,
            page,
            limit,
            from: total === 0 ? 0 : (page - 1) * limit + 1,
            to: Math.min(page * limit, total),
        })
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid ID")
        }

        const { log, attachments } = await this.service.getById(id)
        const data = await AssetLocationSerializer.single(log, attachments)

        return ApiResponse.success(c, data, "Asset location record retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const log = await this.service.create({
            ...body,
            createdByUserId: user?.id,
        })

        const { log: reloaded, attachments } = await this.service.getById(log.id)
        const data = await AssetLocationSerializer.single(reloaded, attachments)
        return ApiResponse.success(c, data, "Asset relocated successfully", 201)
    }
}
