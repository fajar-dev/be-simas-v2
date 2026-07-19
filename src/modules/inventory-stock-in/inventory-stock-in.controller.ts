import { Context } from "hono"
import { InventoryStockInService } from "./inventory-stock-in.service"
import { InventoryStockInSerializer } from "./serializers/inventory-stock-in.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class InventoryStockInController {
    constructor(private readonly service: InventoryStockInService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 20)
        const inventoryId = Number(c.req.query("inventoryId"))
        if (!inventoryId) throw new BadRequestException("inventoryId is required")
        const { data, total } = await this.service.getAll(inventoryId, page, limit)
        return ApiResponse.paginate(c, await InventoryStockInSerializer.collection(data), total, page, limit)
    }

    async store(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const result = await this.service.create(data, user?.id)
        return ApiResponse.success(c, await InventoryStockInSerializer.single(result.stockIn, result.attachments), "Stock added successfully", 201)
    }
}
