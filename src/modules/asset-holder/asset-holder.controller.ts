import { Context } from "hono"
import { AssetHolderService } from "./asset-holder.service"
import { AssetHolderSerializer } from "./serializers/asset-holder.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class AssetHolderController {
    constructor(private readonly service: AssetHolderService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || "1")
        const limit = Number(c.req.query("limit") || "10")
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const assetIdVal = c.req.query("assetId")
        const assetId = assetIdVal ? Number(assetIdVal) : undefined
        const employeeIdVal = c.req.query("employeeId")
        const employeeId = employeeIdVal ? Number(employeeIdVal) : undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, assetId, employeeId)
        const serialized = await AssetHolderSerializer.collection(data)

        return ApiResponse.success(c, serialized, "Asset holder history retrieved successfully", 200, {
            total,
            page,
            limit,
            from: total === 0 ? 0 : (page - 1) * limit + 1,
            to: Math.min(page * limit, total),
        })
    }

    async active(c: Context) {
        const assetId = Number(c.req.param("assetId"))
        if (isNaN(assetId)) {
            throw new BadRequestException("Invalid asset ID")
        }

        const activeLog = await this.service.findActiveByAssetId(assetId)
        if (!activeLog) {
            return ApiResponse.success(c, null, "No active holder for this asset")
        }

        const serialized = await AssetHolderSerializer.single(activeLog.log, activeLog.attachments)
        return ApiResponse.success(c, serialized, "Active holder retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid ID")
        }

        const { log, attachments } = await this.service.getById(id)
        const data = await AssetHolderSerializer.single(log, attachments)

        return ApiResponse.success(c, data, "Asset assignment record retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const log = await this.service.create({
            ...body,
            createdByUserId: user?.id,
        })

        const { log: reloaded, attachments } = await this.service.getById(log.id)
        const data = await AssetHolderSerializer.single(reloaded, attachments)
        return ApiResponse.success(c, data, "Asset assigned successfully", 201)
    }

    async returnAsset(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid ID")
        }

        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const log = await this.service.returnAsset(id, {
            ...body,
            returnedByUserId: user?.id,
        })

        const { log: reloaded, attachments } = await this.service.getById(log.id)
        const data = await AssetHolderSerializer.single(reloaded, attachments)
        return ApiResponse.success(c, data, "Asset returned successfully")
    }
}
