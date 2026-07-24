import { Inventory } from "./entities/inventory.entity"
import { IInventoryRepository, InventoryFilter } from "./interfaces/inventory.repository.interface"
import { IInventoryVariantRepository } from "../inventory-variant/interfaces/inventory-variant.repository.interface"
import { IInventoryStockRepository } from "../inventory-stock/interfaces/inventory-stock.repository.interface"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { CreateInventoryValidator, UpdateInventoryValidator } from "./validators/inventory.validator"
import { AttachmentService } from "../attachment/attachment.service"
import { InventoryLogService } from "../inventory-log/inventory-log.service"
import { STOCK_CONDITIONS } from "../../core/enums"

const ENTITY_INVENTORY = "Inventory"

export class InventoryService {
    constructor(
        private readonly repository: IInventoryRepository,
        private readonly variantRepository: IInventoryVariantRepository,
        private readonly stockRepository: IInventoryStockRepository,
        private readonly attachmentService: AttachmentService,
        private readonly inventoryLogService: InventoryLogService
    ) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: InventoryFilter) {
        return await this.repository.findAll(page, limit, q, sortBy, order, filters)
    }

    async getList() {
        return await this.repository.findList()
    }

    async getById(id: number): Promise<Inventory> {
        const item = await this.repository.findById(id)
        if (!item) throw new NotFoundException("Inventory item not found")
        return item
    }

    async getLabelKeys(): Promise<string[]> {
        return await this.repository.findLabelKeys()
    }

    /**
     * Create an inventory item together with its labels, variants, and each
     * variant's initial stock (per branch × condition) — all in one transaction.
     */
    async create(data: CreateInventoryValidator, userId?: number): Promise<Inventory> {
        const created = await withTransaction(async (manager) => {
            const item = await this.repository.save({
                code: data.code ?? null,
                name: data.name,
                description: data.description ?? null,
                image: data.image ?? null,
                unit: data.unit || "Pcs",
                subCategoryId: data.subCategoryId ?? null,
                isActive: data.isActive ?? true,
                createdByUserId: userId ?? null,
            }, manager)
            // Auto-fill code from the generated id when left empty (like category).
            if (!data.code) {
                item.code = String(item.id)
                await this.repository.save(item, manager)
            }

            for (const label of data.labels ?? []) {
                await this.repository.saveLabel({ inventoryId: item.id, key: label.key, value: label.value }, manager)
            }

            for (const v of data.variants ?? []) {
                const variant = await this.variantRepository.save({
                    inventoryId: item.id,
                    name: v.name,
                    code: v.code ?? null,
                    image: v.image ?? null,
                    description: v.description ?? null,
                    isActive: true,
                }, manager)
                if (!v.code) {
                    variant.code = String(variant.id)
                    await this.variantRepository.save(variant, manager)
                }

                for (const s of v.initialStock ?? []) {
                    for (const condition of STOCK_CONDITIONS) {
                        const qty = condition === "new" ? s.new : s.used
                        if (qty <= 0) continue
                        await this.stockRepository.saveBalance({
                            branchId: s.branchId, variantId: variant.id, condition, quantity: qty,
                        }, manager)
                    }
                }
            }

            if (data.attachmentIds?.length) {
                await this.attachmentService.associate(data.attachmentIds, ENTITY_INVENTORY, item.id, manager)
            }

            await this.inventoryLogService.log({
                inventoryId: item.id,
                module: "inventory",
                action: "create",
                description: `Inventory item "${item.name}" was created.`,
                createdByUserId: userId ?? null,
                newValue: data,
            }, manager)

            return item
        })

        return await this.getById(created.id)
    }

    async update(id: number, data: UpdateInventoryValidator, userId?: number): Promise<Inventory> {
        const item = await this.getById(id)
        const oldValue = { ...item }
        this.repository.merge(item, {
            ...(data.code !== undefined ? { code: data.code ?? null } : {}),
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description ?? null } : {}),
            ...(data.image !== undefined ? { image: data.image ?? null } : {}),
            ...(data.unit !== undefined ? { unit: data.unit || "Pcs" } : {}),
            ...(data.subCategoryId !== undefined ? { subCategoryId: data.subCategoryId ?? null } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        })
        await this.repository.save(item)

        if (data.labels !== undefined) {
            await this.repository.deleteLabels(id)
            for (const label of data.labels) {
                await this.repository.saveLabel({ inventoryId: id, key: label.key, value: label.value })
            }
        }

        if (data.attachmentIds?.length) {
            await this.attachmentService.associate(data.attachmentIds, ENTITY_INVENTORY, id)
        }

        await this.inventoryLogService.log({
            inventoryId: id,
            module: "inventory",
            action: "update",
            description: `Inventory item "${item.name}" was updated.`,
            createdByUserId: userId ?? null,
            oldValue,
            newValue: data,
        })

        return await this.getById(id)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        const variantCount = await this.repository.countVariants(id)
        if (variantCount > 0) {
            throw new ConflictException("Cannot delete an item that still has variants")
        }
        // Not logged: inventory_logs.inventory_id cascades on delete, so a log
        // row for the delete itself would vanish with the item (see AssetService.delete).
        await this.repository.delete(id)
    }
}
