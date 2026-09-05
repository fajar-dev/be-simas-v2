import { Context } from "hono"
import { InventoryStockTransferService } from "./inventory-stock-transfer.service"
import { InventoryStockTransferSerializer } from "./serializers/inventory-stock-transfer.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class InventoryStockTransferController {
    constructor(private readonly service: InventoryStockTransferService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 20)
        const inventoryId = Number(c.req.query("inventoryId"))
        if (!inventoryId) throw new BadRequestException("inventoryId is required")
        const { data, total } = await this.service.getAll(inventoryId, page, limit)
        return ApiResponse.paginate(c, await InventoryStockTransferSerializer.collection(data), total, page, limit)
    }

    async store(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const result = await this.service.create(data, user?.id)
        return ApiResponse.success(c, result, "Stock transferred successfully")
    }
}
