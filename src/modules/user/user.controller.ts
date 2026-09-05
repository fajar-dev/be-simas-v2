import { Context } from "hono"
import { UserService } from "./user.service"
import { UserSerializer } from "./serializers/user.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { resolveFileUrl } from "../../core/helpers/serializer-utils"

const MAX_OPTIONS_LIMIT = 50

export class UserController {
    constructor(private readonly service: UserService) {}

    /** Lightweight picker/select search — not the full paginated list, so non-admin roles can still use it. */
    async options(c: Context) {
        const q = c.req.query("q") || ""
        const requestedLimit = Number(c.req.query("limit")) || 20
        const limit = Math.min(Math.max(requestedLimit, 1), MAX_OPTIONS_LIMIT)

        const users = await this.service.searchOptions(q, limit)
        const data = await Promise.all(
            users.map(async (user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                photo: await resolveFileUrl(user.photo),
            }))
        )
        return ApiResponse.success(c, data, "User options retrieved successfully")
    }

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const isActive = c.req.query("isActive")
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order") || "DESC").toUpperCase() as 'ASC' | 'DESC'

        const filters = { isActive }
        const { data, total } = await this.service.getAll(page, limit, q, filters, sortBy, order)

        const serialized = await UserSerializer.collection(data)
        return ApiResponse.paginate(c, serialized, total, page, limit, 'Users retrieved successfully')
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const user = await this.service.getById(id)
        const serialized = await UserSerializer.single(user)
        return ApiResponse.success(c, serialized, "User retrieved successfully")
    }

    async store(c: Context) {
        const data = c.req.valid("json" as never)
        const user = await this.service.create(data)
        const serialized = await UserSerializer.single(user)
        return ApiResponse.success(c, serialized, "User created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const data = c.req.valid("json" as never)
        const user = await this.service.update(id, data)
        const serialized = await UserSerializer.single(user)
        return ApiResponse.success(c, serialized, "User updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "User deleted successfully")
    }
}
