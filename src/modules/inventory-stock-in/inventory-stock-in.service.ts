import { InventoryStockIn } from "./entities/inventory-stock-in.entity"
import { IInventoryStockInRepository } from "./interfaces/inventory-stock-in.repository.interface"
import { InventoryStockInValidator } from "./validators/inventory-stock-in.validator"
import { BadRequestException, NotFoundException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { InventoryStockService } from "../inventory-stock/inventory-stock.service"
import { InventoryVariantService } from "../inventory-variant/inventory-variant.service"
import { InventoryService } from "../inventory/inventory.service"
import { BranchService } from "../branch/branch.service"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { InventoryLogService } from "../inventory-log/inventory-log.service"
import { STOCK_CONDITIONS } from "../../core/enums"

const ENTITY_STOCK_IN = "InventoryStockIn"

export class InventoryStockInService {
    constructor(
        private readonly repository: IInventoryStockInRepository,
        private readonly inventoryStockService: InventoryStockService,
        private readonly inventoryVariantService: InventoryVariantService,
        private readonly branchService: BranchService,
        private readonly inventoryService: InventoryService,
        private readonly attachmentService: AttachmentService,
        private readonly inventoryLogService: InventoryLogService
    ) {}

    async getById(id: number): Promise<{ stockIn: InventoryStockIn; attachments: Attachment[] }> {
        const stockIn = await this.repository.findById(id)
        if (!stockIn) throw new NotFoundException("Stock-in record not found")
        const attachments = await this.attachmentService.getForEntity(ENTITY_STOCK_IN, id)
        return { stockIn, attachments }
    }

    /** Stock-in: ADD quantities to variants across one or more branches (increments). Optional note + attachments. */
    async create(data: InventoryStockInValidator, userId?: number): Promise<{ stockIn: InventoryStockIn; attachments: Attachment[] }> {
        const item = await this.inventoryService.getById(data.inventoryId)
        const variants = await this.inventoryVariantService.getByInventory(data.inventoryId)
        const validIds = new Set(variants.map((v) => v.id))
        const branchIds = new Set(data.items.map((i) => i.branchId))
        for (const bid of branchIds) await this.branchService.getById(bid)
        for (const stockItem of data.items) {
            if (!validIds.has(stockItem.variantId)) {
                throw new BadRequestException(`Variant ${stockItem.variantId} does not belong to item ${data.inventoryId}`)
            }
        }

        const attachmentIds = data.attachmentIds ?? []

        const stockInId = await withTransaction(async (manager) => {
            const stockIn = await this.repository.save({
                note: data.note ?? null, createdByUserId: userId ?? null,
            }, manager)
            let hasItems = false
            for (const stockItem of data.items) {
                for (const condition of STOCK_CONDITIONS) {
                    const qty = condition === "new" ? stockItem.new : stockItem.used
                    if (qty <= 0) continue
                    const bal = await this.inventoryStockService.increaseBalance(stockItem.branchId, stockItem.variantId, condition, qty, manager)
                    await this.repository.saveItem({
                        stockInId: stockIn.id,
                        variantId: stockItem.variantId,
                        branchId: stockItem.branchId,
                        condition,
                        quantity: qty,
                        balanceAfter: bal.quantity,
                    }, manager)
                    hasItems = true
                }
            }
            if (attachmentIds.length && hasItems) {
                await this.attachmentService.associate(attachmentIds, ENTITY_STOCK_IN, stockIn.id, manager)
            }

            await this.inventoryLogService.log({
                inventoryId: data.inventoryId,
                module: "stock",
                action: "stock_in",
                description: `Stock in recorded for "${item.name}".`,
                createdByUserId: userId ?? null,
                newValue: data,
            }, manager)

            return stockIn.id
        })

        return await this.getById(stockInId)
    }

    /** Paginated stock-in history (incoming stock documents + items) for an item, attachments resolved. */
    async getAll(inventoryId: number, page: number, limit: number) {
        await this.inventoryService.getById(inventoryId)
        const { data, total } = await this.repository.findAll(inventoryId, page, limit)
        const withAttachments = await Promise.all(
            data.map(async (stockIn) => ({
                stockIn,
                attachments: await this.attachmentService.getForEntity(ENTITY_STOCK_IN, stockIn.id),
            }))
        )
        return { data: withAttachments, total }
    }
}
