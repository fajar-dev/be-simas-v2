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

        // Parse label columns to include (only checked ones)
        const labelColumnsParam = c.req.query("labelColumns")
        const labelKeys = labelColumnsParam ? labelColumnsParam.split(',').filter(Boolean) : []

        const { data } = await this.service.getAll(1, 999999, q, sortBy, order, filters)

        // Build Excel
        const ExcelJS = await import('exceljs')
        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet('Assets')

        // Define columns — Active Holder split into 2, Last Location split into 2
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
            { header: 'Holder Name', key: 'holderName', width: 22 },
            { header: 'Holder Employee ID', key: 'holderEmployeeId', width: 18 },
            { header: 'Location', key: 'location', width: 22 },
            { header: 'Branch', key: 'branch', width: 20 },
        ]

        // Add label columns dynamically (only checked ones)
        labelKeys.forEach(key => {
            columns.push({ header: key, key: `label_${key}`, width: 20 })
        })

        sheet.columns = columns

        // Find column indices for merged headers (1-indexed)
        const holderNameCol = columns.findIndex(c => c.key === 'holderName') + 1
        const holderEmpIdCol = columns.findIndex(c => c.key === 'holderEmployeeId') + 1
        const locationCol = columns.findIndex(c => c.key === 'location') + 1
        const branchCol = columns.findIndex(c => c.key === 'branch') + 1

        // Insert a group header row (row 1) with merged cells
        sheet.insertRow(1, [])
        const groupRow = sheet.getRow(1)

        // Merge Active Holder header
        sheet.mergeCells(1, holderNameCol, 1, holderEmpIdCol)
        groupRow.getCell(holderNameCol).value = 'Active Holder'

        // Merge Last Location header
        sheet.mergeCells(1, locationCol, 1, branchCol)
        groupRow.getCell(locationCol).value = 'Last Location'

        // Style group header row (row 1)
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF009838' } },
            alignment: { vertical: 'middle' as const, horizontal: 'center' as const },
        }
        groupRow.height = 24
        groupRow.eachCell({ includeEmpty: false }, (cell) => {
            cell.font = headerStyle.font
            cell.fill = headerStyle.fill
            cell.alignment = headerStyle.alignment
        })

        // Style sub-header row (row 2)
        const subHeaderRow = sheet.getRow(2)
        subHeaderRow.height = 24
        subHeaderRow.eachCell({ includeEmpty: false }, (cell) => {
            cell.font = headerStyle.font
            cell.fill = headerStyle.fill
            cell.alignment = headerStyle.alignment
        })

        // Add data rows (starting from row 3)
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
                holderName: asset.activeHolder?.employee?.name || '',
                holderEmployeeId: asset.activeHolder?.employee?.employeeId || '',
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

        // Auto-filter on sub-header row
        sheet.autoFilter = {
            from: { row: 2, column: 1 },
            to: { row: 2, column: columns.length },
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
