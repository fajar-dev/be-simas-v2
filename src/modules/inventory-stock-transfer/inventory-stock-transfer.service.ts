import { IInventoryStockTransferRepository } from "./interfaces/inventory-stock-transfer.repository.interface"
import { InventoryStockTransferValidator } from "./validators/inventory-stock-transfer.validator"
import { BadRequestException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { InventoryStockService } from "../inventory-stock/inventory-stock.service"
import { InventoryVariantService } from "../inventory-variant/inventory-variant.service"
import { InventoryService } from "../inventory/inventory.service"
import { BranchService } from "../branch/branch.service"
import { AttachmentService } from "../attachment/attachment.service"
import { InventoryLogService } from "../inventory-log/inventory-log.service"

const ENTITY_TRANSFER = "InventoryStockTransfer"

export class InventoryStockTransferService {
    constructor(
        private readonly repository: IInventoryStockTransferRepository,
        private readonly inventoryStockService: InventoryStockService,
        private readonly inventoryVariantService: InventoryVariantService,
        private readonly branchService: BranchService,
        private readonly inventoryService: InventoryService,
        private readonly attachmentService: AttachmentService,
        private readonly inventoryLogService: InventoryLogService
    ) {}

    /** Move stock between branches, preserving condition, atomic and non-negative. Persists a transfer record (history + attachments). */
    async create(data: InventoryStockTransferValidator, userId?: number): Promise<{ referenceId: string; transferId: number }> {
        if (data.fromBranchId === data.toBranchId) {
            throw new BadRequestException("Source and destination branch must be different")
        }
        await this.branchService.getById(data.fromBranchId)
        await this.branchService.getById(data.toBranchId)

        // No duplicate (variant, condition) within one transfer
        const seen = new Set<string>()
        for (const item of data.items) {
            const key = `${item.variantId}:${item.condition}`
            if (seen.has(key)) throw new BadRequestException("Duplicate variant/condition in transfer")
            seen.add(key)
        }

        const referenceId = `TRF-${Date.now()}`
        const attachmentIds = data.attachmentIds ?? []
        const transferId = await withTransaction(async (manager) => {
            const transfer = await this.repository.save({
                fromBranchId: data.fromBranchId,
                toBranchId: data.toBranchId,
                note: data.note ?? null,
                createdByUserId: userId ?? null,
            }, manager)

            const inventoryIds = new Set<number>()
            for (const item of data.items) {
                // Source: lock, check sufficiency, decrement (condition preserved)
                await this.inventoryStockService.decreaseBalance(data.fromBranchId, item.variantId, item.condition, item.quantity, manager)
                // Destination: upsert, increment (same condition)
                await this.inventoryStockService.increaseBalance(data.toBranchId, item.variantId, item.condition, item.quantity, manager)

                await this.repository.saveItem({
                    transferId: transfer.id,
                    variantId: item.variantId,
                    condition: item.condition,
                    quantity: item.quantity,
                }, manager)

                const variant = await this.inventoryVariantService.getById(item.variantId).catch(() => null)
                if (variant) inventoryIds.add(variant.inventoryId)
            }

            if (attachmentIds.length) {
                await this.attachmentService.associate(attachmentIds, ENTITY_TRANSFER, transfer.id, manager)
            }

            for (const inventoryId of inventoryIds) {
                await this.inventoryLogService.log({
                    inventoryId,
                    module: "stock",
                    action: "transfer",
                    description: `Stock transferred from branch #${data.fromBranchId} to branch #${data.toBranchId}.`,
                    createdByUserId: userId ?? null,
                    newValue: data,
                }, manager)
            }

            return transfer.id
        })
        return { referenceId, transferId }
    }

    /** Paginated transfer history for an inventory item, with attachments resolved. */
    async getAll(inventoryId: number, page: number, limit: number) {
        await this.inventoryService.getById(inventoryId)
        const { data, total } = await this.repository.findAll(inventoryId, page, limit)
        const withAttachments = await Promise.all(
            data.map(async (t) => ({
                transfer: t,
                attachments: await this.attachmentService.getForEntity(ENTITY_TRANSFER, t.id),
            }))
        )
        return { data: withAttachments, total }
    }
}
