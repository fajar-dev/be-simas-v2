import { Context } from "hono"
import { AssetMaintenanceService } from "./asset-maintenance.service"
import { AssetMaintenanceSerializer } from "./serializers/asset-maintenance.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class AssetMaintenanceController {
    constructor(private readonly service: AssetMaintenanceService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || "1")
        const limit = Number(c.req.query("limit") || "10")
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || ""
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const assetIdVal = c.req.query("assetId")
        const assetId = assetIdVal ? Number(assetIdVal) : undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, assetId)
        const serialized = await AssetMaintenanceSerializer.collection(data)

        return ApiResponse.success(c, serialized, "Asset maintenance records retrieved successfully", 200, {
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

        const { maintenance, attachments } = await this.service.getById(id)
        const data = await AssetMaintenanceSerializer.single(maintenance, attachments)

        return ApiResponse.success(c, data, "Asset maintenance record retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const maintenance = await this.service.create({
            ...body,
            createdByUserId: user?.id,
        })
        
        // Fetch fresh associated attachments to serialize
        const { attachments } = await this.service.getById(maintenance.id)
        const data = await AssetMaintenanceSerializer.single(maintenance, attachments)

        return ApiResponse.success(c, data, "Asset maintenance record created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid ID")
        }

        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const maintenance = await this.service.update(id, body, user?.id)

        // Fetch fresh associated attachments to serialize
        const { attachments } = await this.service.getById(maintenance.id)
        const data = await AssetMaintenanceSerializer.single(maintenance, attachments)

        return ApiResponse.success(c, data, "Asset maintenance record updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid ID")
        }

        const user = c.get("user")
        await this.service.delete(id, user?.id)
        return ApiResponse.success(c, null, "Asset maintenance record deleted successfully")
    }
}
