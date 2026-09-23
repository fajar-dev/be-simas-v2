import { Context } from "hono"
import { TransferService } from "./transfer.service"
import { TransferSerializer } from "./serializers/transfer.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { TransferFilter } from "./interfaces/transfer.repository.interface"

export class TransferController {
    constructor(private readonly service: TransferService) {}

    async intake(c: Context) {
        const body = c.req.valid("json" as never) as any
        const item = await this.service.intake(body)
        const data = TransferSerializer.single(item)
        return ApiResponse.success(c, data, "Transfer item received", 201)
    }

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order")?.toUpperCase() === "ASC" ? "ASC" : "DESC") as "ASC" | "DESC"
        const status = c.req.query("status") || undefined
        const filters: TransferFilter = { status }

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, filters)
        const serialized = TransferSerializer.collection(data)
        return ApiResponse.paginate(c, serialized, total, page, limit, "Transfer items retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const transfer = await this.service.getById(id)
        const data = TransferSerializer.single(transfer)
        return ApiResponse.success(c, data, "Transfer item retrieved successfully")
    }

    async merge(c: Context) {
        const id = Number(c.req.param("id"))
        const body = c.req.valid("json" as never) as any
        const transfer = await this.service.merge(id, body.assetIds)
        const data = TransferSerializer.single(transfer)
        return ApiResponse.success(c, data, "Transfer item merged into asset successfully")
    }
}
