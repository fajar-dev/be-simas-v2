import { Context } from "hono"
import { RoleService } from "./role.service"
import { ApiResponse } from "../../core/helpers/response"

export class RoleController {
    constructor(private readonly service: RoleService) {}

    async permissions(c: Context) {
        const data = await this.service.getAllPermissions()
        return ApiResponse.success(c, data, "Permissions retrieved successfully")
    }

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""

        const { data, total } = await this.service.getAll(page, limit, q)
        return ApiResponse.paginate(c, data, total, page, limit, "Roles retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const role = await this.service.getById(id)
        return ApiResponse.success(c, role, "Role retrieved successfully")
    }

    async store(c: Context) {
        const data = c.req.valid("json" as never)
        const role = await this.service.create(data)
        return ApiResponse.success(c, role, "Role created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const data = c.req.valid("json" as never)
        const role = await this.service.update(id, data)
        return ApiResponse.success(c, role, "Role updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "Role deleted successfully")
    }
}
