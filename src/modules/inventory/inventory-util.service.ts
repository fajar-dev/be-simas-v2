import ExcelJS from "exceljs"
import { In } from "typeorm"
import { Inventory } from "./entities/inventory.entity"
import { config } from "../../config/config"
import { AppDataSource } from "../../config/database"
import { InventoryVariant } from "../inventory-variant/entities/inventory-variant.entity"
import { InventoryStockBalance } from "../inventory-stock/entities/inventory-stock-balance.entity"

export class InventoryUtilService {
    async export(data: Inventory[], labelKeys: string[]): Promise<Buffer> {
        const ids = data.map((item) => item.id)

        // Fetch variants for the exported items, then balances for those variants — two batched
        // queries instead of N+1, grouped in-memory below.
        const variants = ids.length
            ? await AppDataSource.getRepository(InventoryVariant).find({ where: { inventoryId: In(ids) }, order: { name: "ASC" } })
            : []
        const variantIds = variants.map((v) => v.id)
        const balances = variantIds.length
            ? await AppDataSource.getRepository(InventoryStockBalance).find({ where: { variantId: In(variantIds) }, relations: ["branch"], order: { branchId: "ASC", condition: "ASC" } })
            : []

        const variantsByInventory = new Map<number, InventoryVariant[]>()
        for (const v of variants) {
            const arr = variantsByInventory.get(v.inventoryId) || []
            arr.push(v)
            variantsByInventory.set(v.inventoryId, arr)
        }
        const balancesByVariant = new Map<number, InventoryStockBalance[]>()
        for (const b of balances) {
            const arr = balancesByVariant.get(b.variantId) || []
            arr.push(b)
            balancesByVariant.set(b.variantId, arr)
        }

        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet("Inventory")

        // Define columns
        const columns: { header: string; key: string; width: number }[] = [
            { header: "No", key: "no", width: 5 },
            { header: "Image", key: "image", width: 15 },
            { header: "Code", key: "code", width: 15 },
            { header: "Name", key: "name", width: 30 },
            { header: "Description", key: "description", width: 30 },
            { header: "Category", key: "category", width: 20 },
            { header: "Sub Category", key: "subCategory", width: 20 },
            { header: "Unit", key: "unit", width: 12 },
            { header: "Status", key: "status", width: 12 },
            { header: "Variant Name", key: "variantName", width: 25 },
            { header: "Variant Code", key: "variantCode", width: 18 },
            { header: "Variant Description", key: "variantDescription", width: 25 },
            { header: "Branch", key: "branch", width: 20 },
            { header: "Condition", key: "condition", width: 12 },
            { header: "Quantity", key: "quantity", width: 12 },
        ]

        // Add label columns dynamically (only checked ones)
        labelKeys.forEach((key) => {
            columns.push({ header: key, key: `label_${key}`, width: 20 })
        })

        sheet.columns = columns

        // Column indices (1-indexed)
        const imageCol = columns.findIndex((c) => c.key === "image") + 1
        const variantNameCol = columns.findIndex((c) => c.key === "variantName") + 1
        const variantCodeCol = columns.findIndex((c) => c.key === "variantCode") + 1
        const variantDescriptionCol = columns.findIndex((c) => c.key === "variantDescription") + 1
        const branchCol = columns.findIndex((c) => c.key === "branch") + 1
        const quantityCol = columns.findIndex((c) => c.key === "quantity") + 1
        const firstLabelCol = labelKeys.length > 0 ? columns.findIndex((c) => c.key === `label_${labelKeys[0]}`) + 1 : 0
        const lastLabelCol = labelKeys.length > 0 ? firstLabelCol + labelKeys.length - 1 : 0

        // Single-column headers, and the item-level data columns (one value per item, spanning all
        // its leaf rows) — same set, plus label columns for the data-row merge.
        const singleCols = ["no", "image", "code", "name", "description", "category", "subCategory", "unit", "status"]
        const itemColIndices = singleCols.map((key) => columns.findIndex((c) => c.key === key) + 1)
        labelKeys.forEach((key) => itemColIndices.push(columns.findIndex((c) => c.key === `label_${key}`) + 1))
        // Variant-level columns — one value per variant, spans its own branch × condition rows.
        const variantColIndices = [variantNameCol, variantCodeCol, variantDescriptionCol]

        // Insert group header row (row 1), sub-header becomes row 2
        sheet.insertRow(1, [])
        const groupRow = sheet.getRow(1)
        const subHeaderRow = sheet.getRow(2)

        // Single-column headers: merge vertically (row 1 + row 2)
        singleCols.forEach((key) => {
            const colIdx = columns.findIndex((c) => c.key === key) + 1
            const header = columns[colIdx - 1].header
            sheet.mergeCells(1, colIdx, 2, colIdx)
            groupRow.getCell(colIdx).value = header
        })

        // Variant: merge horizontally in row 1
        sheet.mergeCells(1, variantNameCol, 1, variantDescriptionCol)
        groupRow.getCell(variantNameCol).value = "Variant"

        // Stock: merge horizontally in row 1
        sheet.mergeCells(1, branchCol, 1, quantityCol)
        groupRow.getCell(branchCol).value = "Stock"

        // Labels: merge horizontally in row 1
        if (labelKeys.length > 0) {
            if (labelKeys.length > 1) {
                sheet.mergeCells(1, firstLabelCol, 1, lastLabelCol)
            }
            groupRow.getCell(firstLabelCol).value = "Labels"
        }

        // Header style
        const headerStyle = {
            font: { bold: true, color: { argb: "FFFFFFFF" } } as ExcelJS.Font,
            fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF009838" } } as ExcelJS.FillPattern,
            alignment: { vertical: "middle" as const, horizontal: "center" as const } as Partial<ExcelJS.Alignment>,
        }

        for (const row of [groupRow, subHeaderRow]) {
            row.height = 24
            row.eachCell({ includeEmpty: false }, (cell) => {
                cell.font = headerStyle.font
                cell.fill = headerStyle.fill
                cell.alignment = headerStyle.alignment
            })
        }

        // Add data rows (starting from row 3) — one physical row per (item, variant, branch ×
        // condition) leaf, but the item- and variant-level columns are merged (rowspan) across
        // their own leaf rows instead of repeating the value, so the hierarchy reads visually.
        const mergeVertical = (colIdx: number, fromRow: number, toRow: number) => {
            if (toRow > fromRow) sheet.mergeCells(fromRow, colIdx, toRow, colIdx)
        }

        let currentRow = 3
        data.forEach((item, itemIdx) => {
            const itemStartRow = currentRow
            const itemFill = itemIdx % 2 === 1
                ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF5F5F5" } }
                : undefined

            const labelValues: Record<string, string> = {}
            labelKeys.forEach((key) => {
                const label = (item.labels || []).find((l) => l.key === key)
                labelValues[`label_${key}`] = label?.value || ""
            })

            const writeLeafRow = (variant: InventoryVariant | null, branch: string, condition: string, quantity: number | string) => {
                const dataRow = sheet.addRow({
                    no: itemIdx + 1,
                    image: "",
                    code: item.code,
                    name: item.name,
                    description: item.description || "",
                    category: item.subCategory?.category?.name || "",
                    subCategory: item.subCategory?.name || "",
                    unit: item.unit || "",
                    status: item.isActive ? "Active" : "Inactive",
                    variantName: variant?.name || "",
                    variantCode: variant?.code || "",
                    variantDescription: variant?.description || "",
                    branch,
                    condition,
                    quantity,
                    ...labelValues,
                })
                if (itemFill) dataRow.fill = itemFill
                currentRow++
            }

            const itemVariants = variantsByInventory.get(item.id) || []

            if (itemVariants.length === 0) {
                writeLeafRow(null, "", "", "")
            } else {
                for (const variant of itemVariants) {
                    const variantStartRow = currentRow
                    const variantBalances = balancesByVariant.get(variant.id) || []
                    if (variantBalances.length === 0) {
                        writeLeafRow(variant, "", "", "")
                    } else {
                        for (const balance of variantBalances) {
                            writeLeafRow(variant, balance.branch?.name || "", balance.condition === "new" ? "New" : "Used", balance.quantity)
                        }
                    }
                    const variantEndRow = currentRow - 1
                    variantColIndices.forEach((colIdx) => {
                        mergeVertical(colIdx, variantStartRow, variantEndRow)
                        sheet.getCell(variantStartRow, colIdx).alignment = { vertical: "middle" }
                    })
                }
            }

            const itemEndRow = currentRow - 1

            // Set the item's image hyperlink once, on the block's top (master) cell.
            if (item.image) {
                const imageCell = sheet.getCell(itemStartRow, imageCol)
                const proxyUrl = `${config.app.appUrl}/api/proxy?path=${encodeURI(item.image)}`
                imageCell.value = { text: "View Image", hyperlink: proxyUrl }
                imageCell.font = { color: { argb: "FF0066CC" }, underline: true }
            }

            itemColIndices.forEach((colIdx) => {
                mergeVertical(colIdx, itemStartRow, itemEndRow)
                sheet.getCell(itemStartRow, colIdx).alignment = { vertical: "middle" }
            })
        })

        // Add borders to all cells, including cells hidden behind a merge (default eachCell skips them).
        for (let r = 3; r < currentRow; r++) {
            const row = sheet.getRow(r)
            for (let c = 1; c <= columns.length; c++) {
                row.getCell(c).border = {
                    top: { style: "thin", color: { argb: "FFD0D0D0" } },
                    left: { style: "thin", color: { argb: "FFD0D0D0" } },
                    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
                    right: { style: "thin", color: { argb: "FFD0D0D0" } },
                }
            }
        }
        for (const row of [groupRow, subHeaderRow]) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = {
                    top: { style: "thin", color: { argb: "FFD0D0D0" } },
                    left: { style: "thin", color: { argb: "FFD0D0D0" } },
                    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
                    right: { style: "thin", color: { argb: "FFD0D0D0" } },
                }
            })
        }

        // Auto-filter on sub-header row
        sheet.autoFilter = {
            from: { row: 2, column: 1 },
            to: { row: 2, column: columns.length },
        }

        return Buffer.from(await workbook.xlsx.writeBuffer())
    }
}
