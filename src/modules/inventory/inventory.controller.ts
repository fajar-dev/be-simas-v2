import { Context } from "hono"
import { InventoryService } from "./inventory.service"
import { InventorySerializer } from "./serializers/inventory.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class InventoryController {
    constructor(private readonly service: InventoryService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order)
        return ApiResponse.paginate(c, await InventorySerializer.collection(data), total, page, limit)
    }

    async list(c: Context) {
        const data = await this.service.getList()
        return ApiResponse.success(c, await InventorySerializer.collection(data))
    }

    async show(c: Context) {
        const product = await this.service.getById(Number(c.req.param("id")))
        return ApiResponse.success(c, await InventorySerializer.single(product))
    }

    async store(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const product = await this.service.create(data, user?.id)
        return ApiResponse.success(c, await InventorySerializer.single(product), "Created", 201)
    }

    async update(c: Context) {
        const data = c.req.valid("json" as never) as any
        const product = await this.service.update(Number(c.req.param("id")), data)
        return ApiResponse.success(c, await InventorySerializer.single(product), "Updated")
    }

    async destroy(c: Context) {
        await this.service.delete(Number(c.req.param("id")))
        return ApiResponse.success(c, null, "Deleted")
    }
}
