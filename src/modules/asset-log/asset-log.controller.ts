import { Context } from "hono"
import { AssetLogService } from "./asset-log.service"
import { AssetLogSerializer } from "./serializers/asset-log.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class AssetLogController {
    constructor(private readonly service: AssetLogService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || "1")
        const limit = Number(c.req.query("limit") || "10")
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || ""
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const assetIdVal = c.req.query("assetId")
        const assetId = assetIdVal ? Number(assetIdVal) : undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, assetId)
        const serialized = await AssetLogSerializer.collection(data)

        return ApiResponse.success(c, serialized, "Asset activity logs retrieved successfully", 200, {
            total,
            page,
            limit,
            from: total === 0 ? 0 : (page - 1) * limit + 1,
            to: Math.min(page * limit, total),
        })
    }
}
