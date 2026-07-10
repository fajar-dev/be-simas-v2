import { Context } from "hono"
import { InventoryStockService } from "./inventory-stock.service"
import { InventoryStockSerializer } from "./serializers/inventory-stock.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"
import { StockCondition } from "../../core/enums"

export class InventoryStockController {
    constructor(private readonly service: InventoryStockService) {}

    async entryTemplate(c: Context) {
        const branchId = Number(c.req.query("branchId"))
        const productId = Number(c.req.query("productId"))
        if (!branchId || !productId) throw new BadRequestException("branchId and productId are required")
        const { variants, balances } = await this.service.getEntryTemplate(branchId, productId)
        return ApiResponse.success(c, InventoryStockSerializer.entryTemplate(variants, balances))
    }

    async entry(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const balances = await this.service.entry(data, user?.id)
        return ApiResponse.success(c, InventoryStockSerializer.balances(balances), "Stock saved successfully")
    }

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 20)
        const { data, total } = await this.service.getBalances(page, limit, {
            branchId: c.req.query("branchId") ? Number(c.req.query("branchId")) : undefined,
            productId: c.req.query("productId") ? Number(c.req.query("productId")) : undefined,
            variantId: c.req.query("variantId") ? Number(c.req.query("variantId")) : undefined,
            condition: (c.req.query("condition") as StockCondition) || undefined,
        })
        return ApiResponse.paginate(c, InventoryStockSerializer.balances(data), total, page, limit)
    }

    async transfer(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const result = await this.service.transfer(data, user?.id)
        return ApiResponse.success(c, result, "Stock transferred successfully")
    }

    async movements(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 20)
        const { data, total } = await this.service.getMovements(page, limit, {
            productId: c.req.query("productId") ? Number(c.req.query("productId")) : undefined,
            branchId: c.req.query("branchId") ? Number(c.req.query("branchId")) : undefined,
            variantId: c.req.query("variantId") ? Number(c.req.query("variantId")) : undefined,
            condition: (c.req.query("condition") as StockCondition) || undefined,
            type: c.req.query("type") || undefined,
        })
        return ApiResponse.paginate(c, await InventoryStockSerializer.movements(data), total, page, limit)
    }

    async holdings(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 20)
        const { data, total } = await this.service.getHoldings(page, limit, {
            productId: c.req.query("productId") ? Number(c.req.query("productId")) : undefined,
            variantId: c.req.query("variantId") ? Number(c.req.query("variantId")) : undefined,
            employeeId: c.req.query("employeeId") ? Number(c.req.query("employeeId")) : undefined,
            branchId: c.req.query("branchId") ? Number(c.req.query("branchId")) : undefined,
            active: c.req.query("active") === "true" ? true : undefined,
        })
        return ApiResponse.paginate(c, InventoryStockSerializer.holdings(data), total, page, limit)
    }

    async assign(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const holdings = await this.service.assign(data, user?.id)
        return ApiResponse.success(c, InventoryStockSerializer.holdings(holdings), "Stock assigned successfully", 201)
    }

    async returnStock(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        await this.service.returnStock(data, user?.id)
        return ApiResponse.success(c, null, "Stock returned successfully")
    }
}
