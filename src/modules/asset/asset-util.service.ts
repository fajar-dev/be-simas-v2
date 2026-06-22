import { Asset } from "./entities/asset.entity"
import ExcelJS from "exceljs"

export class AssetUtilService {

    async export(data: Asset[], labelKeys: string[]): Promise<Buffer> {
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

        // Column indices (1-indexed)
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

        // Single-column headers: merge vertically (row 1 + row 2) and set value in row 1
        const singleCols = ['no', 'code', 'name', 'description', 'category', 'subCategory', 'brand', 'model', 'price', 'purchaseDate', 'status']
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

        // Labels: merge horizontally in row 1, key names in row 2
        if (labelKeys.length > 0) {
            if (labelKeys.length > 1) {
                sheet.mergeCells(1, firstLabelCol, 1, lastLabelCol)
            }
            groupRow.getCell(firstLabelCol).value = 'Labels'
        }

        // Header style
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } } as ExcelJS.Font,
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF009838' } } as ExcelJS.FillPattern,
            alignment: { vertical: 'middle' as const, horizontal: 'center' as const } as Partial<ExcelJS.Alignment>,
        }

        // Style both header rows
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
}
