import { Context } from "hono"
import { AssetStatusService } from "./asset-status.service"
import { AssetStatusSerializer } from "./serializers/asset-status.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class AssetStatusController {
    constructor(private readonly service: AssetStatusService) {}

    async index(c: Context) {
        const assetId = Number(c.req.query("assetId") || 0)
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)

        if (!assetId) {
            return ApiResponse.success(c, [], "Asset ID is required")
        }

        const { data, total } = await this.service.getByAssetId(assetId, page, limit)
        const serialized = await AssetStatusSerializer.collection(data)
        return ApiResponse.paginate(c, serialized, total, page, limit, "Asset statuses retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any

        const record = await this.service.create({
            ...data,
            createdByUserId: user?.id,
        })

        const full = await this.service.findLastStatus(record.assetId)
        const serialized = full ? await AssetStatusSerializer.single(full) : null
        return ApiResponse.success(c, serialized, "Asset status created successfully", 201)
    }

    async bulkStore(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any

        const result = await this.service.bulkCreate({
            ...data,
            createdByUserId: user?.id,
        })

        return ApiResponse.success(c, result, "Asset statuses updated successfully", 201)
    }
}
