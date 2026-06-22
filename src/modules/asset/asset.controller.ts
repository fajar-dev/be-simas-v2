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

        // Parse filter params (same as index)
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

        // Parse label filters
        const allQueries = c.req.queries()
        const labelFilters: { key: string; value: string }[] = []
        for (const [qKey, values] of Object.entries(allQueries)) {
            if (qKey.startsWith('label.') && values?.[0]) {
                labelFilters.push({ key: qKey.substring(6), value: values[0] })
            }
        }
        if (labelFilters.length) filters.labels = labelFilters

        const { data } = await this.service.getAll(1, 999999, q, sortBy, order, filters)

        // Collect all unique label keys from the data
        const allLabelKeys = new Set<string>()
        data.forEach(asset => {
            (asset.labels || []).forEach(l => allLabelKeys.add(l.key))
        })
        const labelKeys = Array.from(allLabelKeys).sort()

        // Build Excel
        const ExcelJS = await import('exceljs')
        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet('Assets')

        // Define columns
        const columns: { header: string; key: string; width: number }[] = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Code', key: 'code', width: 15 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Sub Category', key: 'subCategory', width: 20 },
            { header: 'Brand', key: 'brand', width: 15 },
            { header: 'Model', key: 'model', width: 15 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Active Holder', key: 'activeHolder', width: 25 },
            { header: 'Location', key: 'location', width: 25 },
            { header: 'Branch', key: 'branch', width: 20 },
        ]

        // Add label columns dynamically
        labelKeys.forEach(key => {
            columns.push({ header: key, key: `label_${key}`, width: 20 })
        })

        sheet.columns = columns

        // Style header row
        const headerRow = sheet.getRow(1)
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF009838' },
        }
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
        headerRow.height = 24

        // Add data rows
        data.forEach((asset, index) => {
            const row: Record<string, any> = {
                no: index + 1,
                code: asset.code,
                name: asset.name,
                description: asset.description || '',
                category: asset.subCategory?.category?.name || '',
                subCategory: asset.subCategory?.name || '',
                brand: asset.brand || '',
                model: asset.model || '',
                price: asset.price ?? '',
                purchaseDate: asset.purchaseDate || '',
                status: asset.lastStatus?.status || '',
                activeHolder: asset.activeHolder?.employee?.name
                    ? `${asset.activeHolder.employee.name} (${asset.activeHolder.employee.employeeId || ''})`
                    : '',
                location: asset.lastLocation?.location?.name || '',
                branch: asset.lastLocation?.location?.branch?.name || '',
            }

            // Add label values
            labelKeys.forEach(key => {
                const label = (asset.labels || []).find(l => l.key === key)
                row[`label_${key}`] = label?.value || ''
            })

            const dataRow = sheet.addRow(row)
            // Alternate row colors
            if (index % 2 === 1) {
                dataRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' },
                }
            }
        })

        // Add borders to all cells
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                }
            })
        })

        // Auto-filter
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: columns.length },
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer()
        const filename = `assets_export_${new Date().toISOString().slice(0, 10)}.xlsx`

        return new Response(buffer as ArrayBuffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    }
}
