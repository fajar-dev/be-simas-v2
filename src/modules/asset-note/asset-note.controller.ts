import { Context } from "hono"
import { AssetNoteService } from "./asset-note.service"
import { AssetNoteSerializer } from "./serializers/asset-note.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class AssetNoteController {
    constructor(private readonly service: AssetNoteService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || "1")
        const limit = Number(c.req.query("limit") || "10")
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const assetIdVal = c.req.query("assetId")
        const assetId = assetIdVal ? Number(assetIdVal) : undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, assetId)
        const serialized = await AssetNoteSerializer.collection(data)

        return ApiResponse.success(c, serialized, "Asset note records retrieved successfully", 200, {
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

        const { note, attachments } = await this.service.getById(id)
        const data = await AssetNoteSerializer.single(note, attachments)

        return ApiResponse.success(c, data, "Asset note record retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const note = await this.service.create({
            ...body,
            createdByUserId: user?.id,
        })
        
        // Fetch fresh associated attachments to serialize
        const { attachments } = await this.service.getById(note.id)
        const data = await AssetNoteSerializer.single(note, attachments)

        return ApiResponse.success(c, data, "Asset note record created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid ID")
        }

        const user = c.get("user")
        const body = c.req.valid("json" as never) as any
        const note = await this.service.update(id, body, user?.id)

        // Fetch fresh associated attachments to serialize
        const { attachments } = await this.service.getById(note.id)
        const data = await AssetNoteSerializer.single(note, attachments)

        return ApiResponse.success(c, data, "Asset note record updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        if (isNaN(id)) {
            throw new BadRequestException("Invalid ID")
        }

        const user = c.get("user")
        await this.service.delete(id, user?.id)
        return ApiResponse.success(c, null, "Asset note record deleted successfully")
    }

    async getLabelKeys(c: Context) {
        const assetIdVal = c.req.query("assetId")
        const assetId = assetIdVal ? Number(assetIdVal) : undefined
        const keys = await this.service.getUniqueLabelKeys(assetId)
        return ApiResponse.success(c, keys, "Label keys retrieved successfully")
    }
}
