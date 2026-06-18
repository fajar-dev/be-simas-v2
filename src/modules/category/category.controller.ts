import { Context } from "hono"
import { CategoryService } from "./category.service"
import { CategorySerializer } from "./serializers/category.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class CategoryController {
    constructor(private readonly service: CategoryService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""

        const { data, total } = await this.service.getAll(page, limit, q)

        return ApiResponse.paginate(c, CategorySerializer.collection(data), total, page, limit, "Categories retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const category = await this.service.getById(id)
        return ApiResponse.success(c, CategorySerializer.single(category), "Category retrieved successfully")
    }

    async store(c: Context) {
        const data = c.req.valid("json" as never)
        const category = await this.service.create(data)
        return ApiResponse.success(c, CategorySerializer.single(category), "Category created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const data = c.req.valid("json" as never)
        const category = await this.service.update(id, data)
        return ApiResponse.success(c, CategorySerializer.single(category), "Category updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "Category deleted successfully")
    }
}
