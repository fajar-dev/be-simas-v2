import { Context } from "hono"
import { InventoryVariantService } from "./inventory-variant.service"
import { InventoryVariantSerializer } from "./serializers/inventory-variant.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class InventoryVariantController {
    constructor(private readonly service: InventoryVariantService) {}

    async index(c: Context) {
        const inventoryId = Number(c.req.query("inventoryId"))
        if (!inventoryId) throw new BadRequestException("inventoryId is required")
        const variants = await this.service.getByInventory(inventoryId)
        return ApiResponse.success(c, InventoryVariantSerializer.collection(variants))
    }

    async show(c: Context) {
        const variant = await this.service.getById(Number(c.req.param("id")))
        return ApiResponse.success(c, InventoryVariantSerializer.single(variant))
    }

    async store(c: Context) {
        const data = c.req.valid("json" as never) as any
        const variant = await this.service.create(data)
        return ApiResponse.success(c, InventoryVariantSerializer.single(variant), "Created", 201)
    }

    async update(c: Context) {
        const data = c.req.valid("json" as never) as any
        const variant = await this.service.update(Number(c.req.param("id")), data)
        return ApiResponse.success(c, InventoryVariantSerializer.single(variant), "Updated")
    }

    async destroy(c: Context) {
        await this.service.delete(Number(c.req.param("id")))
        return ApiResponse.success(c, null, "Deleted")
    }
}
