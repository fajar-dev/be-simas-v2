import { Context } from "hono"
import { SubCategoryService } from "./sub-category.service"
import { SubCategorySerializer } from "./serializers/sub-category.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class SubCategoryController {
    constructor(private readonly service: SubCategoryService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""

        const { data, total } = await this.service.getAll(page, limit, q)

        return ApiResponse.paginate(c, SubCategorySerializer.collection(data), total, page, limit, "Sub categories retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const subCategory = await this.service.getById(id)
        return ApiResponse.success(c, SubCategorySerializer.single(subCategory), "Sub category retrieved successfully")
    }

    async store(c: Context) {
        const data = c.req.valid("json" as never)
        const subCategory = await this.service.create(data)
        const full = await this.service.getById(subCategory.id)
        return ApiResponse.success(c, SubCategorySerializer.single(full), "Sub category created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const data = c.req.valid("json" as never)
        await this.service.update(id, data)
        const full = await this.service.getById(id)
        return ApiResponse.success(c, SubCategorySerializer.single(full), "Sub category updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "Sub category deleted successfully")
    }
}
