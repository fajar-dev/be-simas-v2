import { Context } from "hono"
import { LocationService } from "./location.service"
import { LocationSerializer } from "./serializers/location.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class LocationController {
    constructor(private readonly service: LocationService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const branchId = c.req.query("branchId") ? Number(c.req.query("branchId")) : undefined
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order") || "DESC").toUpperCase() as 'ASC' | 'DESC'

        const { data, total } = await this.service.getAll(page, limit, q, branchId, sortBy, order)

        return ApiResponse.paginate(c, LocationSerializer.collection(data), total, page, limit, "Locations retrieved successfully")
    }

    async byBranch(c: Context) {
        const branchId = Number(c.req.param("branchId"))
        const data = await this.service.getByBranchId(branchId)
        return ApiResponse.success(c, LocationSerializer.collection(data), "Locations retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const location = await this.service.getById(id)
        return ApiResponse.success(c, LocationSerializer.single(location), "Location retrieved successfully")
    }

    async store(c: Context) {
        const data = c.req.valid("json" as never)
        const location = await this.service.create(data)
        const full = await this.service.getById(location.id)
        return ApiResponse.success(c, LocationSerializer.single(full), "Location created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const data = c.req.valid("json" as never)
        await this.service.update(id, data)
        const full = await this.service.getById(id)
        return ApiResponse.success(c, LocationSerializer.single(full), "Location updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "Location deleted successfully")
    }
}
