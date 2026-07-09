import { Asset } from "./entities/asset.entity"
import ExcelJS from "exceljs"
import { config } from "../../config/config"
import { AppDataSource } from "../../config/database"
import { SubCategory } from "../sub-category/entities/sub-category.entity"
import type { AssetService } from "./asset.service"

export class AssetUtilService {
    constructor(private readonly assetService: AssetService) {}

    async export(data: Asset[], labelKeys: string[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet('Assets')

        // Define columns
        const columns: { header: string; key: string; width: number }[] = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Image', key: 'image', width: 15 },
            { header: 'Code', key: 'code', width: 15 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Sub Category', key: 'subCategory', width: 20 },
            { header: 'Brand', key: 'brand', width: 15 },
            { header: 'Model', key: 'model', width: 15 },
            { header: 'BLE Tag MAC', key: 'bleTagMac', width: 20 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Holder Name', key: 'holderName', width: 22 },
            { header: 'Holder Employee ID', key: 'holderEmployeeId', width: 18 },
            { header: 'Location', key: 'location', width: 22 },
            { header: 'Branch', key: 'branch', width: 20 },
            { header: 'Useful Life (Years)', key: 'usefulLife', width: 18 },
            { header: 'Monthly Depreciation', key: 'monthlyDepreciation', width: 22 },
            { header: 'Accumulated Depreciation', key: 'accumulatedDepreciation', width: 25 },
            { header: 'Book Value', key: 'bookValue', width: 18 },
        ]

        // Add label columns dynamically (only checked ones)
        labelKeys.forEach(key => {
            columns.push({ header: key, key: `label_${key}`, width: 20 })
        })

        sheet.columns = columns

        // Column indices (1-indexed)
        const imageCol = columns.findIndex(c => c.key === 'image') + 1
        const holderNameCol = columns.findIndex(c => c.key === 'holderName') + 1
        const holderEmpIdCol = columns.findIndex(c => c.key === 'holderEmployeeId') + 1
        const locationCol = columns.findIndex(c => c.key === 'location') + 1
        const branchCol = columns.findIndex(c => c.key === 'branch') + 1
        const firstLabelCol = labelKeys.length > 0 ? columns.findIndex(c => c.key === `label_${labelKeys[0]}`) + 1 : 0
        const lastLabelCol = labelKeys.length > 0 ? firstLabelCol + labelKeys.length - 1 : 0

        // Insert group header row (row 1), sub-header becomes row 2
        sheet.insertRow(1, [])
        const groupRow = sheet.getRow(1)
        const subHeaderRow = sheet.getRow(2)

        // Single-column headers: merge vertically (row 1 + row 2)
        const singleCols = ['no', 'image', 'code', 'name', 'description', 'category', 'subCategory', 'brand', 'model', 'bleTagMac', 'price', 'purchaseDate', 'status']
        singleCols.forEach(key => {
            const colIdx = columns.findIndex(c => c.key === key) + 1
            const header = columns[colIdx - 1].header
            sheet.mergeCells(1, colIdx, 2, colIdx)
            groupRow.getCell(colIdx).value = header
        })

        // Active Holder: merge horizontally in row 1
        sheet.mergeCells(1, holderNameCol, 1, holderEmpIdCol)
        groupRow.getCell(holderNameCol).value = 'Active Holder'

        // Last Location: merge horizontally in row 1
        sheet.mergeCells(1, locationCol, 1, branchCol)
        groupRow.getCell(locationCol).value = 'Last Location'

        // Labels: merge horizontally in row 1
        if (labelKeys.length > 0) {
            if (labelKeys.length > 1) {
                sheet.mergeCells(1, firstLabelCol, 1, lastLabelCol)
            }
            groupRow.getCell(firstLabelCol).value = 'Labels'
        }

        // Depreciation: merge horizontally in row 1
        const usefulLifeCol = columns.findIndex(c => c.key === 'usefulLife') + 1
        const bookValueCol = columns.findIndex(c => c.key === 'bookValue') + 1
        sheet.mergeCells(1, usefulLifeCol, 1, bookValueCol)
        groupRow.getCell(usefulLifeCol).value = 'Depreciation'

        // Header style
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } } as ExcelJS.Font,
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF009838' } } as ExcelJS.FillPattern,
            alignment: { vertical: 'middle' as const, horizontal: 'center' as const } as Partial<ExcelJS.Alignment>,
        }

        for (const row of [groupRow, subHeaderRow]) {
            row.height = 24
            row.eachCell({ includeEmpty: false }, (cell) => {
                cell.font = headerStyle.font
                cell.fill = headerStyle.fill
                cell.alignment = headerStyle.alignment
            })
        }

        // Add data rows (starting from row 3)
        data.forEach((asset, index) => {
            const row: Record<string, any> = {
                no: index + 1,
                image: '',
                code: asset.code,
                name: asset.name,
                description: asset.description || '',
                category: asset.subCategory?.category?.name || '',
                subCategory: asset.subCategory?.name || '',
                brand: asset.brand || '',
                model: asset.model || '',
                bleTagMac: asset.bleTagMac || '',
                price: asset.price ?? '',
                purchaseDate: asset.purchaseDate || '',
                status: asset.lastStatus?.status || '',
                holderName: asset.activeHolder?.employee?.name || '',
                holderEmployeeId: asset.activeHolder?.employee?.employeeId || '',
                location: asset.lastLocation?.location?.name || '',
                branch: asset.lastLocation?.location?.branch?.name || '',
            }

            // Compute depreciation
            const dep = this.calculateDepreciation(asset.price, asset.usefulLife, asset.purchaseDate)
            row.usefulLife = asset.usefulLife ?? ''
            row.monthlyDepreciation = dep.monthlyDepreciation ?? ''
            row.accumulatedDepreciation = dep.accumulatedDepreciation ?? ''
            row.bookValue = dep.bookValue ?? ''

            labelKeys.forEach(key => {
                const label = (asset.labels || []).find(l => l.key === key)
                row[`label_${key}`] = label?.value || ''
            })

            const dataRow = sheet.addRow(row)

            // Set hyperlink for image cell
            if (asset.image) {
                const imageCell = dataRow.getCell(imageCol)
                const proxyUrl = `${config.app.appUrl}/api/proxy?path=${encodeURI(asset.image)}`
                imageCell.value = { text: 'View Image', hyperlink: proxyUrl }
                imageCell.font = { color: { argb: 'FF0066CC' }, underline: true }
            }

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

        return Buffer.from(await workbook.xlsx.writeBuffer())
    }

    async template(): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook()

        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } } as ExcelJS.Font,
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF009838' } } as ExcelJS.FillPattern,
            alignment: { vertical: 'middle' as const, horizontal: 'center' as const } as Partial<ExcelJS.Alignment>,
        }

        // ── Sheet 1: Template ──
        const templateSheet = workbook.addWorksheet('Template')
        templateSheet.columns = [
            { header: 'Asset Code *', key: 'code', width: 18 },
            { header: 'Name *', key: 'name', width: 30 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Sub Category Code *', key: 'subCategoryCode', width: 22 },
            { header: 'Brand', key: 'brand', width: 15 },
            { header: 'Model', key: 'model', width: 15 },
            { header: 'BLE Tag MAC', key: 'bleTagMac', width: 20 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Purchase Date', key: 'purchaseDate', width: 18 },
            { header: 'Useful Life (Years)', key: 'usefulLife', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
        ]

        const templateHeader = templateSheet.getRow(1)
        templateHeader.height = 24
        templateHeader.eachCell((cell) => {
            cell.font = headerStyle.font
            cell.fill = headerStyle.fill
            cell.alignment = headerStyle.alignment
        })

        // Add example row
        templateSheet.addRow({
            code: 'AST-001',
            name: 'Laptop Dell XPS 15',
            description: 'Laptop kantor',
            subCategoryCode: 'SC-001',
            brand: 'Dell',
            model: 'XPS 15',
            bleTagMac: 'AA:BB:CC:DD:EE:FF',
            price: 15000000,
            purchaseDate: '2024-01-15',
            usefulLife: 5,
            status: 'active',
        })
        const exampleRow = templateSheet.getRow(2)
        exampleRow.font = { italic: true, color: { argb: 'FF999999' } }

        // ── Sheet 2: Reference ──
        const refSheet = workbook.addWorksheet('Reference')

        // Fetch reference data
        const subCategories = await AppDataSource.getRepository(SubCategory)
            .createQueryBuilder('sc')
            .leftJoinAndSelect('sc.category', 'cat')
            .orderBy('cat.name', 'ASC')
            .addOrderBy('sc.name', 'ASC')
            .getMany()

        // Status types for reference
        const statusTypes = [
            { value: 'active', label: 'Active' },
            { value: 'idle', label: 'Idle' },
            { value: 'under_repair', label: 'Under Repair' },
            { value: 'damaged', label: 'Damaged' },
            { value: 'lost', label: 'Lost' },
            { value: 'sold', label: 'Sold' },
            { value: 'disposed', label: 'Disposed' },
        ]

        // Sub Category reference table
        const scStartCol = 1
        refSheet.getColumn(scStartCol).width = 5
        refSheet.getColumn(scStartCol + 1).width = 18
        refSheet.getColumn(scStartCol + 2).width = 25
        refSheet.getColumn(scStartCol + 3).width = 20

        const scTitleRow = refSheet.getRow(1)
        refSheet.mergeCells(1, scStartCol, 1, scStartCol + 3)
        scTitleRow.getCell(scStartCol).value = 'Sub Category Codes'
        scTitleRow.getCell(scStartCol).font = headerStyle.font
        scTitleRow.getCell(scStartCol).fill = headerStyle.fill
        scTitleRow.getCell(scStartCol).alignment = headerStyle.alignment
        scTitleRow.height = 24

        const scHeaderRow = refSheet.getRow(2)
        const scHeaders = ['No', 'Code', 'Sub Category Name', 'Category']
        scHeaders.forEach((h, i) => {
            const cell = scHeaderRow.getCell(scStartCol + i)
            cell.value = h
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF555555' } }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
        })
        scHeaderRow.height = 22

        subCategories.forEach((sc, i) => {
            const row = refSheet.getRow(3 + i)
            row.getCell(scStartCol).value = i + 1
            row.getCell(scStartCol + 1).value = sc.code
            row.getCell(scStartCol + 2).value = sc.name
            row.getCell(scStartCol + 3).value = sc.category?.name || ''
        })

        // Status reference table (start after a gap)
        const stStartCol = 6
        refSheet.getColumn(stStartCol).width = 5
        refSheet.getColumn(stStartCol + 1).width = 18
        refSheet.getColumn(stStartCol + 2).width = 18

        const stTitleRow = refSheet.getRow(1)
        refSheet.mergeCells(1, stStartCol, 1, stStartCol + 2)
        stTitleRow.getCell(stStartCol).value = 'Status Types'
        stTitleRow.getCell(stStartCol).font = headerStyle.font
        stTitleRow.getCell(stStartCol).fill = headerStyle.fill
        stTitleRow.getCell(stStartCol).alignment = headerStyle.alignment

        const stHeaderRow = refSheet.getRow(2)
        const stHeaders = ['No', 'Value', 'Label']
        stHeaders.forEach((h, i) => {
            const cell = stHeaderRow.getCell(stStartCol + i)
            cell.value = h
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF555555' } }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
        })

        statusTypes.forEach((st, i) => {
            const row = refSheet.getRow(3 + i)
            row.getCell(stStartCol).value = i + 1
            row.getCell(stStartCol + 1).value = st.value
            row.getCell(stStartCol + 2).value = st.label
        })

        // Add borders to reference sheet
        refSheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                }
            })
        })

        // Add dropdown validation on Template sheet
        const scCodeCol = templateSheet.getColumn('subCategoryCode')
        const statusCol = templateSheet.getColumn('status')
        const scLastRow = 2 + subCategories.length  // data starts at row 3 in Reference
        const stLastRow = 2 + statusTypes.length

        // Apply to rows 2–1000 (enough room for data entry)
        for (let r = 2; r <= 1000; r++) {
            templateSheet.getCell(r, scCodeCol.number).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Reference!$B$3:$B$${scLastRow}`],
                showErrorMessage: true,
                errorTitle: 'Invalid Sub Category',
                error: 'Please select a valid Sub Category Code from the dropdown.',
            }
            templateSheet.getCell(r, statusCol.number).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Reference!$G$3:$G$${stLastRow}`],
                showErrorMessage: true,
                errorTitle: 'Invalid Status',
                error: 'Please select a valid status from the dropdown.',
            }
        }

        return Buffer.from(await workbook.xlsx.writeBuffer())
    }

    async import(buffer: Buffer, userId?: number): Promise<{ success: number; errors: { row: number; message: string }[] }> {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer as any)

        const sheet = workbook.getWorksheet('Template') || workbook.getWorksheet(1)
        if (!sheet) throw new Error('Worksheet not found')

        // Build lookup maps
        const subCategoryRepo = AppDataSource.getRepository(SubCategory)

        const subCategories = await subCategoryRepo.find()
        const scMap = new Map(subCategories.map(sc => [sc.code.toLowerCase(), sc]))


        const errors: { row: number; message: string }[] = []
        let success = 0

        // Read header row to determine column mapping
        const headerRow = sheet.getRow(1)
        const colMap: Record<string, number> = {}
        headerRow.eachCell((cell, colNumber) => {
            const val = String(cell.value || '').trim().toLowerCase()
            if (val.includes('asset code')) colMap['code'] = colNumber
            else if (val === 'name *' || val === 'name') colMap['name'] = colNumber
            else if (val.includes('description')) colMap['description'] = colNumber
            else if (val.includes('sub category code')) colMap['subCategoryCode'] = colNumber
            else if (val === 'brand') colMap['brand'] = colNumber
            else if (val === 'model') colMap['model'] = colNumber
            else if (val.includes('ble tag mac') || val.includes('ble mac') || val.includes('bletagmac')) colMap['bleTagMac'] = colNumber
            else if (val === 'price') colMap['price'] = colNumber
            else if (val.includes('purchase date')) colMap['purchaseDate'] = colNumber
            else if (val === 'status') colMap['status'] = colNumber
            else if (val.includes('useful life')) colMap['usefulLife'] = colNumber
        })

        const getCellValue = (row: ExcelJS.Row, key: string): string => {
            const col = colMap[key]
            if (!col) return ''
            const val = row.getCell(col).value
            if (val === null || val === undefined) return ''
            return String(val).trim()
        }

        // Process data rows (skip header and example row if italic)
        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i)

            const code = getCellValue(row, 'code')
            const name = getCellValue(row, 'name')

            // Skip empty rows
            if (!code && !name) continue

            // Skip example row (italic)
            const firstCell = row.getCell(colMap['code'] || 1)
            if (firstCell.font?.italic) continue

            // Validate required fields
            if (!code) {
                errors.push({ row: i, message: 'Asset Code is required' })
                continue
            }
            if (!name) {
                errors.push({ row: i, message: 'Name is required' })
                continue
            }

            const subCategoryCode = getCellValue(row, 'subCategoryCode')
            if (!subCategoryCode) {
                errors.push({ row: i, message: 'Sub Category Code is required' })
                continue
            }

            const subCategory = scMap.get(subCategoryCode.toLowerCase())
            if (!subCategory) {
                errors.push({ row: i, message: `Sub Category Code "${subCategoryCode}" not found` })
                continue
            }

            const priceVal = getCellValue(row, 'price')
            const price = priceVal ? Number(priceVal) : undefined

            const purchaseDate = getCellValue(row, 'purchaseDate')
            const description = getCellValue(row, 'description')
            const brand = getCellValue(row, 'brand')
            const model = getCellValue(row, 'model')
            const bleTagMac = getCellValue(row, 'bleTagMac')
            const status = getCellValue(row, 'status')
            const usefulLifeVal = getCellValue(row, 'usefulLife')
            const usefulLife = usefulLifeVal ? Number(usefulLifeVal) : undefined

            // Only include usefulLife if both price and purchaseDate are provided
            const finalUsefulLife = (usefulLife && !isNaN(usefulLife) && price && !isNaN(price) && purchaseDate) ? usefulLife : undefined

            try {
                await this.assetService.create({
                    code,
                    name,
                    description: description || undefined,
                    subCategoryId: subCategory.id,
                    brand: brand || undefined,
                    model: model || undefined,
                    bleTagMac: bleTagMac || undefined,
                    price: !isNaN(price as number) ? price : undefined,
                    purchaseDate: purchaseDate || undefined,
                    usefulLife: finalUsefulLife,
                    status: status || undefined,
                    createdByUserId: userId,
                })
                success++
            } catch (err: any) {
                const msg = err?.message?.includes('UNIQUE') || err?.message?.includes('Duplicate')
                    ? `Asset code "${code}" already exists`
                    : (err?.message || 'Unknown error')
                errors.push({ row: i, message: msg })
            }
        }

        return { success, errors }
    }

    private calculateDepreciation(price?: number | null, usefulLife?: number | null, purchaseDate?: string | null) {
        const round2 = (n: number) => Math.round(n * 100) / 100
        const monthlyDepreciation = (price && usefulLife) ? round2(price / (usefulLife * 12)) : null
        if (!monthlyDepreciation || !purchaseDate || !price) {
            return { monthlyDepreciation, accumulatedDepreciation: null, bookValue: null }
        }
        const start = new Date(purchaseDate)
        const now = new Date()
        const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
        const elapsed = Math.max(0, monthsElapsed)
        const accumulatedDepreciation = round2(Math.min(monthlyDepreciation * elapsed, price))
        const bookValue = round2(Math.max(price - accumulatedDepreciation, 0))
        return { monthlyDepreciation, accumulatedDepreciation, bookValue }
    }
}
