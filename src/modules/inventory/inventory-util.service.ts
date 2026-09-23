import ExcelJS from "exceljs"
import { Inventory } from "./entities/inventory.entity"
import { config } from "../../config/config"
import { InventoryVariant } from "../inventory-variant/entities/inventory-variant.entity"
import { InventoryStockBalance } from "../inventory-stock/entities/inventory-stock-balance.entity"
import type { IInventoryVariantRepository } from "../inventory-variant/interfaces/inventory-variant.repository.interface"
import type { IInventoryStockRepository } from "../inventory-stock/interfaces/inventory-stock.repository.interface"

export class InventoryUtilService {
    constructor(
        private readonly variantRepository: IInventoryVariantRepository,
        private readonly stockRepository: IInventoryStockRepository
    ) {}

    async export(data: Inventory[], labelKeys: string[]): Promise<Buffer> {
        const ids = data.map((item) => item.id)

        // Batched in two queries (variants, then balances) instead of N+1, grouped in-memory below.
        const variants = await this.variantRepository.findByInventoryIds(ids)
        const variantIds = variants.map((v) => v.id)
        const balances = await this.stockRepository.findBalancesByVariants(variantIds)

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

        labelKeys.forEach((key) => {
            columns.push({ header: key, key: `label_${key}`, width: 20 })
        })

        sheet.columns = columns

        const imageCol = columns.findIndex((c) => c.key === "image") + 1
        const codeCol = columns.findIndex((c) => c.key === "code") + 1
        const variantNameCol = columns.findIndex((c) => c.key === "variantName") + 1
        const variantCodeCol = columns.findIndex((c) => c.key === "variantCode") + 1
        const variantDescriptionCol = columns.findIndex((c) => c.key === "variantDescription") + 1
        const branchCol = columns.findIndex((c) => c.key === "branch") + 1
        const quantityCol = columns.findIndex((c) => c.key === "quantity") + 1
        const firstLabelCol = labelKeys.length > 0 ? columns.findIndex((c) => c.key === `label_${labelKeys[0]}`) + 1 : 0
        const lastLabelCol = labelKeys.length > 0 ? firstLabelCol + labelKeys.length - 1 : 0

        // Item-level columns span all of that item's leaf rows via vertical merge below.
        const singleCols = ["no", "image", "code", "name", "description", "category", "subCategory", "unit", "status"]
        const itemColIndices = singleCols.map((key) => columns.findIndex((c) => c.key === key) + 1)
        labelKeys.forEach((key) => itemColIndices.push(columns.findIndex((c) => c.key === `label_${key}`) + 1))
        // Variant-level columns span that variant's own branch × condition rows.
        const variantColIndices = [variantNameCol, variantCodeCol, variantDescriptionCol]

        sheet.insertRow(1, [])
        const groupRow = sheet.getRow(1)
        const subHeaderRow = sheet.getRow(2)

        singleCols.forEach((key) => {
            const colIdx = columns.findIndex((c) => c.key === key) + 1
            const header = columns[colIdx - 1].header
            sheet.mergeCells(1, colIdx, 2, colIdx)
            groupRow.getCell(colIdx).value = header
        })

        sheet.mergeCells(1, variantNameCol, 1, variantDescriptionCol)
        groupRow.getCell(variantNameCol).value = "Variant"

        sheet.mergeCells(1, branchCol, 1, quantityCol)
        groupRow.getCell(branchCol).value = "Stock"

        if (labelKeys.length > 0) {
            if (labelKeys.length > 1) {
                sheet.mergeCells(1, firstLabelCol, 1, lastLabelCol)
            }
            groupRow.getCell(firstLabelCol).value = "Labels"
        }

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

        // One row per (item, variant, branch × condition) leaf; item/variant columns are rowspan-merged.
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

            // Set once, on the block's top (master) cell — the rest are merged into it.
            if (item.image) {
                const imageCell = sheet.getCell(itemStartRow, imageCol)
                const proxyUrl = `${config.app.appUrl}/api/proxy?path=${encodeURI(item.image)}`
                imageCell.value = { text: "View Image", hyperlink: proxyUrl }
                imageCell.font = { color: { argb: "FF0066CC" }, underline: true }
            }

            const codeCell = sheet.getCell(itemStartRow, codeCol)
            codeCell.value = { text: item.code || String(item.id), hyperlink: `${config.app.appUrl}/inventory/${item.id}` }
            codeCell.font = { color: { argb: "FF0066CC" }, underline: true }

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

        sheet.autoFilter = {
            from: { row: 2, column: 1 },
            to: { row: 2, column: columns.length },
        }

        return Buffer.from(await workbook.xlsx.writeBuffer())
    }
}
