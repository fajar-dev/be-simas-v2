import { Context } from "hono"
import { InventoryStockOutService } from "./inventory-stock-out.service"
import { InventoryStockOutSerializer } from "./serializers/inventory-stock-out.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class InventoryStockOutController {
    constructor(private readonly service: InventoryStockOutService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 20)
        const { data, total } = await this.service.getStockOuts(page, limit, {
            inventoryId: c.req.query("inventoryId") ? Number(c.req.query("inventoryId")) : undefined,
            variantId: c.req.query("variantId") ? Number(c.req.query("variantId")) : undefined,
            employeeId: c.req.query("employeeId") ? Number(c.req.query("employeeId")) : undefined,
            branchId: c.req.query("branchId") ? Number(c.req.query("branchId")) : undefined,
            active: c.req.query("active") === "true" ? true : undefined,
        })
        return ApiResponse.paginate(c, await InventoryStockOutSerializer.collection(data), total, page, limit)
    }

    async assign(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const { stockOut, attachments } = await this.service.assign(data, user?.id)
        return ApiResponse.success(c, await InventoryStockOutSerializer.single(stockOut, attachments), "Stock assigned successfully", 201)
    }

    async returnStock(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        await this.service.returnStock(data, user?.id)
        return ApiResponse.success(c, null, "Stock returned successfully")
    }
}
