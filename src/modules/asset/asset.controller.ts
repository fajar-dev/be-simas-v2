import { Context } from "hono"
import { AssetService } from "./asset.service"
import { AssetSerializer } from "./serializers/asset.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { AssetFilter } from "./interfaces/asset.repository.interface"

export class AssetController {
    constructor(private readonly service: AssetService) {}

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order") || "DESC").toUpperCase() as 'ASC' | 'DESC'

        // Parse filter params
        const filters: AssetFilter = {}
        if (c.req.query("categoryId")) filters.categoryId = Number(c.req.query("categoryId"))
        if (c.req.query("subCategoryId")) filters.subCategoryId = Number(c.req.query("subCategoryId"))
        if (c.req.query("branchId")) filters.branchId = Number(c.req.query("branchId"))
        if (c.req.query("locationId")) filters.locationId = Number(c.req.query("locationId"))
        const holderStatus = c.req.query("holderStatus")
        if (holderStatus === 'has_holder' || holderStatus === 'no_holder') filters.holderStatus = holderStatus
        if (c.req.query("holderId")) filters.holderId = Number(c.req.query("holderId"))
        if (c.req.query("priceMin")) filters.priceMin = Number(c.req.query("priceMin"))
        if (c.req.query("priceMax")) filters.priceMax = Number(c.req.query("priceMax"))
        if (c.req.query("purchaseDateFrom")) filters.purchaseDateFrom = c.req.query("purchaseDateFrom")!
        if (c.req.query("purchaseDateTo")) filters.purchaseDateTo = c.req.query("purchaseDateTo")!

        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, filters)

        const serialized = await AssetSerializer.collection(data)
        return ApiResponse.paginate(c, serialized, total, page, limit, "Assets retrieved successfully")
    }

    async show(c: Context) {
        const id = Number(c.req.param("id"))
        const asset = await this.service.getById(id)
        const serialized = await AssetSerializer.single(asset)
        return ApiResponse.success(c, serialized, "Asset retrieved successfully")
    }

    async checkCode(c: Context) {
        const code = c.req.query("code") || ""
        if (!code) {
            return ApiResponse.success(c, { exists: false }, "Code is empty")
        }
        const excludeId = c.req.query("excludeId") ? Number(c.req.query("excludeId")) : undefined
        const exists = await this.service.checkCode(code, excludeId)
        return ApiResponse.success(c, { exists }, exists ? "Code already exists" : "Code is available")
    }

    async getLabelKeys(c: Context) {
        const keys = await this.service.getUniqueLabelKeys()
        return ApiResponse.success(c, keys, "Label keys retrieved successfully")
    }

    async store(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const asset = await this.service.create({
            ...data,
            createdByUserId: user?.id,
        })
        const full = await this.service.getById(asset.id)
        const serialized = await AssetSerializer.single(full)
        return ApiResponse.success(c, serialized, "Asset created successfully", 201)
    }

    async update(c: Context) {
        const id = Number(c.req.param("id"))
        const user = c.get("user")
        const data = c.req.valid("json" as never)
        await this.service.update(id, data, user?.id)
        const full = await this.service.getById(id)
        const serialized = await AssetSerializer.single(full)
        return ApiResponse.success(c, serialized, "Asset updated successfully")
    }

    async destroy(c: Context) {
        const id = Number(c.req.param("id"))
        await this.service.delete(id)
        return ApiResponse.success(c, null, "Asset deleted successfully")
    }
}
