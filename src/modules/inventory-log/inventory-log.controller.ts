import { Context } from "hono"
import { InventoryLogService } from "./inventory-log.service"
import { InventoryLogSerializer } from "./serializers/inventory-log.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class InventoryLogController {
    constructor(private readonly service: InventoryLogService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || "1")
        const limit = Number(c.req.query("limit") || "10")
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const inventoryIdVal = c.req.query("inventoryId")
        const inventoryId = inventoryIdVal ? Number(inventoryIdVal) : undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, inventoryId)
        const serialized = await InventoryLogSerializer.collection(data)

        return ApiResponse.success(c, serialized, "Inventory activity logs retrieved successfully", 200, {
            total,
            page,
            limit,
            from: total === 0 ? 0 : (page - 1) * limit + 1,
            to: Math.min(page * limit, total),
        })
    }
}
