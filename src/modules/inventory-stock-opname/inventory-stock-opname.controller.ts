import { Context } from "hono"
import { InventoryStockOpnameService } from "./inventory-stock-opname.service"
import { InventoryStockOpnameSerializer } from "./serializers/inventory-stock-opname.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class InventoryStockOpnameController {
    constructor(private readonly service: InventoryStockOpnameService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 20)
        const inventoryId = Number(c.req.query("inventoryId"))
        if (!inventoryId) throw new BadRequestException("inventoryId is required")
        const { data, total } = await this.service.getAll(inventoryId, page, limit)
        return ApiResponse.paginate(c, await InventoryStockOpnameSerializer.collection(data), total, page, limit)
    }

    async store(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const result = await this.service.create(data, user?.id)
        return ApiResponse.success(c, await InventoryStockOpnameSerializer.single(result.opname, result.attachments), "Stock opname saved successfully", 201)
    }
}
