import { Context } from "hono"
import { AssetService } from "./asset.service"
import { AssetUtilService } from "./asset-util.service"
import { AssetSerializer } from "./serializers/asset.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { AssetFilter } from "./interfaces/asset.repository.interface"

export class AssetController {
    constructor(
        private readonly service: AssetService,
        private readonly utilService: AssetUtilService,
    ) {}

        private parseFilters(c: Context): AssetFilter {
        const parseIds = (val: string | undefined) => val ? val.split(',').map(Number).filter(n => !isNaN(n)) : undefined

        const filters: AssetFilter = {}
        const categoryIds = parseIds(c.req.query("categoryIds"))
        if (categoryIds?.length) filters.categoryIds = categoryIds
        const subCategoryIds = parseIds(c.req.query("subCategoryIds"))
        if (subCategoryIds?.length) filters.subCategoryIds = subCategoryIds
        const branchIds = parseIds(c.req.query("branchIds"))
        if (branchIds?.length) filters.branchIds = branchIds
        const locationIds = parseIds(c.req.query("locationIds"))
        if (locationIds?.length) filters.locationIds = locationIds

        const statusParam = c.req.query("status")
        if (statusParam) filters.status = statusParam.split(',')

        const holderStatus = c.req.query("holderStatus")
        if (holderStatus === 'has_holder' || holderStatus === 'no_holder') filters.holderStatus = holderStatus
        if (c.req.query("holderId")) filters.holderId = Number(c.req.query("holderId"))
        if (c.req.query("priceMin")) filters.priceMin = Number(c.req.query("priceMin"))
        if (c.req.query("priceMax")) filters.priceMax = Number(c.req.query("priceMax"))
        if (c.req.query("purchaseDateFrom")) filters.purchaseDateFrom = c.req.query("purchaseDateFrom")!
        if (c.req.query("purchaseDateTo")) filters.purchaseDateTo = c.req.query("purchaseDateTo")!
        const missingFields = c.req.query("missingFields")
        if (missingFields) filters.missingFields = missingFields.split(',')

        // Parse label filters: label.{key}=value
        const allQueries = c.req.queries()
        const labelFilters: { key: string; value: string }[] = []
        for (const [qKey, values] of Object.entries(allQueries)) {
            if (qKey.startsWith('label.') && values?.[0]) {
                labelFilters.push({ key: qKey.substring(6), value: values[0] })
            }
        }
        if (labelFilters.length) filters.labels = labelFilters

        return filters
    }

    async index(c: Context) {
        const page = Number(c.req.query("page") || 1)
        const limit = Number(c.req.query("limit") || 10)
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order") || "DESC").toUpperCase() as 'ASC' | 'DESC'

        const filters = this.parseFilters(c)

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

    async export(c: Context) {
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order") || "DESC").toUpperCase() as 'ASC' | 'DESC'

        const filters = this.parseFilters(c)

        const labelColumnsParam = c.req.query("labelColumns")
        const labelKeys = labelColumnsParam ? labelColumnsParam.split(',').filter(Boolean) : []

        const data = await this.service.getAllForExport(q, sortBy, order, filters)

        const buffer = await this.utilService.export(data, labelKeys)
        const filename = `assets_export_${new Date().toISOString().slice(0, 10)}.xlsx`

        return new Response(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    }

    async importTemplate(c: Context) {
        const buffer = await this.utilService.template()

        return new Response(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="asset_import_template.xlsx"',
            },
        })
    }

    async import(c: Context) {
        const user = c.get("user")
        const body = await c.req.parseBody()
        const file = body['file']

        if (!file || !(file instanceof File)) {
            return ApiResponse.error(c, "File is required", 400)
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const result = await this.utilService.import(buffer, user?.id)

        return ApiResponse.success(c, result, `Import completed: ${result.success} success, ${result.errors.length} errors`)
    }
}

