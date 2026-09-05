import { InventoryStockOpname } from "./entities/inventory-stock-opname.entity"
import { IInventoryStockOpnameRepository } from "./interfaces/inventory-stock-opname.repository.interface"
import { InventoryStockOpnameValidator } from "./validators/inventory-stock-opname.validator"
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

const ENTITY_STOCK_OPNAME = "InventoryStockOpname"

export class InventoryStockOpnameService {
    constructor(
        private readonly repository: IInventoryStockOpnameRepository,
        private readonly inventoryStockService: InventoryStockService,
        private readonly inventoryVariantService: InventoryVariantService,
        private readonly branchService: BranchService,
        private readonly inventoryService: InventoryService,
        private readonly attachmentService: AttachmentService,
        private readonly inventoryLogService: InventoryLogService
    ) {}

    async getById(id: number): Promise<{ opname: InventoryStockOpname; attachments: Attachment[] }> {
        const opname = await this.repository.findById(id)
        if (!opname) throw new NotFoundException("Stock opname record not found")
        const attachments = await this.attachmentService.getForEntity(ENTITY_STOCK_OPNAME, id)
        return { opname, attachments }
    }

    /** Stock opname: SET variants at one branch to their physically counted quantities. Optional note + attachments. */
    async create(data: InventoryStockOpnameValidator, userId?: number): Promise<{ opname: InventoryStockOpname; attachments: Attachment[] }> {
        const item = await this.inventoryService.getById(data.inventoryId)
        await this.branchService.getById(data.branchId)
        const variants = await this.inventoryVariantService.getByInventory(data.inventoryId)
        const validIds = new Set(variants.map((v) => v.id))
        for (const opnameItem of data.items) {
            if (!validIds.has(opnameItem.variantId)) {
                throw new BadRequestException(`Variant ${opnameItem.variantId} does not belong to item ${data.inventoryId}`)
            }
        }

        const attachmentIds = data.attachmentIds ?? []

        const opnameId = await withTransaction(async (manager) => {
            const opname = await this.repository.save({
                branchId: data.branchId, note: data.note ?? null, createdByUserId: userId ?? null,
            }, manager)
            let hasItems = false
            for (const opnameItem of data.items) {
                for (const condition of STOCK_CONDITIONS) {
                    const target = condition === "new" ? opnameItem.new : opnameItem.used
                    const { previousQuantity, delta } = await this.inventoryStockService.setBalance(data.branchId, opnameItem.variantId, condition, target, manager)
                    if (delta === 0) continue
                    await this.repository.saveItem({
                        opnameId: opname.id,
                        variantId: opnameItem.variantId,
                        condition,
                        systemQuantity: previousQuantity,
                        countedQuantity: target,
                        quantity: delta,
                    }, manager)
                    hasItems = true
                }
            }
            if (attachmentIds.length && hasItems) {
                await this.attachmentService.associate(attachmentIds, ENTITY_STOCK_OPNAME, opname.id, manager)
            }

            await this.inventoryLogService.log({
                inventoryId: data.inventoryId,
                module: "stock",
                action: "opname",
                description: `Stock opname recorded for "${item.name}".`,
                createdByUserId: userId ?? null,
                newValue: data,
            }, manager)

            return opname.id
        })

        return await this.getById(opnameId)
    }

    /** Paginated stock opname history (count documents + items) for an item, attachments resolved. */
    async getAll(inventoryId: number, page: number, limit: number) {
        await this.inventoryService.getById(inventoryId)
        const { data, total } = await this.repository.findAll(inventoryId, page, limit)
        const withAttachments = await Promise.all(
            data.map(async (opname) => ({
                opname,
                attachments: await this.attachmentService.getForEntity(ENTITY_STOCK_OPNAME, opname.id),
            }))
        )
        return { data: withAttachments, total }
    }
}
