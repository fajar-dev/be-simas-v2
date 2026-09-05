import { Context } from "hono"
import { InventoryService } from "./inventory.service"
import { InventoryUtilService } from "./inventory-util.service"
import { InventorySerializer } from "./serializers/inventory.serialize"
import { ApiResponse } from "../../core/helpers/response"
import { InventoryFilter } from "./interfaces/inventory.repository.interface"

export class InventoryController {
    constructor(
        private readonly service: InventoryService,
        private readonly utilService: InventoryUtilService
    ) {}

    private parseFilters(c: Context): InventoryFilter {
        const parseIds = (val: string | undefined) => val ? val.split(',').map(Number).filter(n => !isNaN(n)) : undefined

        const filters: InventoryFilter = {}
        const categoryIds = parseIds(c.req.query("categoryIds"))
        if (categoryIds?.length) filters.categoryIds = categoryIds
        const subCategoryIds = parseIds(c.req.query("subCategoryIds"))
        if (subCategoryIds?.length) filters.subCategoryIds = subCategoryIds

        const unitsParam = c.req.query("units")
        if (unitsParam) filters.units = unitsParam.split(',')

        const isActiveParam = c.req.query("isActive")
        if (isActiveParam === 'true' || isActiveParam === 'false') filters.isActive = isActiveParam === 'true'

        const variantStatus = c.req.query("variantStatus")
        if (variantStatus === 'has_variants' || variantStatus === 'no_variants') filters.variantStatus = variantStatus

        if (c.req.query("newStockMin")) filters.newStockMin = Number(c.req.query("newStockMin"))
        if (c.req.query("newStockMax")) filters.newStockMax = Number(c.req.query("newStockMax"))
        if (c.req.query("usedStockMin")) filters.usedStockMin = Number(c.req.query("usedStockMin"))
        if (c.req.query("usedStockMax")) filters.usedStockMax = Number(c.req.query("usedStockMax"))

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
        const order = c.req.query("order") as "ASC" | "DESC" | undefined
        const filters = this.parseFilters(c)
        const { data, total } = await this.service.getAll(page, limit, q, sortBy, order, filters)
        return ApiResponse.paginate(c, await InventorySerializer.collection(data), total, page, limit)
    }

    async export(c: Context) {
        const q = c.req.query("q") || ""
        const sortBy = c.req.query("sortBy") || undefined
        const order = (c.req.query("order") || "DESC").toUpperCase() as "ASC" | "DESC"

        const filters = this.parseFilters(c)

        const labelColumnsParam = c.req.query("labelColumns")
        const labelKeys = labelColumnsParam ? labelColumnsParam.split(',').filter(Boolean) : []

        const data = await this.service.getAllForExport(q, sortBy, order, filters)

        const buffer = await this.utilService.export(data, labelKeys)
        const filename = `inventory_export_${new Date().toISOString().slice(0, 10)}.xlsx`

        return new Response(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    }

    async list(c: Context) {
        const data = await this.service.getList()
        return ApiResponse.success(c, await InventorySerializer.collection(data))
    }

    async labelKeys(c: Context) {
        const keys = await this.service.getLabelKeys()
        return ApiResponse.success(c, keys)
    }

    async show(c: Context) {
        const item = await this.service.getById(Number(c.req.param("id")))
        return ApiResponse.success(c, await InventorySerializer.single(item))
    }

    async store(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const item = await this.service.create(data, user?.id)
        return ApiResponse.success(c, await InventorySerializer.single(item), "Created", 201)
    }

    async update(c: Context) {
        const user = c.get("user")
        const data = c.req.valid("json" as never) as any
        const item = await this.service.update(Number(c.req.param("id")), data, user?.id)
        return ApiResponse.success(c, await InventorySerializer.single(item), "Updated")
    }

    async destroy(c: Context) {
        await this.service.delete(Number(c.req.param("id")))
        return ApiResponse.success(c, null, "Deleted")
    }
}
