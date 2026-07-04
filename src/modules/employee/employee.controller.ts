import { Context } from "hono"
import { EmployeeService } from "./employee.service"
import { EmployeeSerializer } from "./serializers/employee.serialize"
import { ApiResponse } from "../../core/helpers/response"

export class EmployeeController {
    constructor(private readonly service: EmployeeService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order") || "DESC").toUpperCase() as 'ASC' | 'DESC'
        const isActiveParam = c.req.query("isActive")
        const isActive = isActiveParam !== undefined && isActiveParam !== '' ? isActiveParam === "true" : undefined

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, isActive)

        const serialized = await EmployeeSerializer.collection(data)
        return ApiResponse.paginate(c, serialized, total, page, limit, "Employees retrieved successfully")
    }

    async list(c: Context) {
        const isActiveParam = c.req.query("isActive")
        const isActive = isActiveParam !== undefined ? isActiveParam === "true" : undefined
        const data = await this.service.getList(isActive)
        const serialized = await EmployeeSerializer.listCollection(data)
        return ApiResponse.success(c, serialized, "Employees retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const employee = await this.service.getById(id)
        const serialized = await EmployeeSerializer.single(employee)
        return ApiResponse.success(c, serialized, "Employee retrieved successfully")
    }

    async store(c: Context) {
        const data = c.req.valid("json" as never)
        const employee = await this.service.create(data)
        const serialized = await EmployeeSerializer.single(employee)
        return ApiResponse.success(c, serialized, "Employee created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const data = c.req.valid("json" as never)
        const employee = await this.service.update(id, data)
        const serialized = await EmployeeSerializer.single(employee)
        return ApiResponse.success(c, serialized, "Employee updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "Employee deleted successfully")
    }
}
