import { Inventory } from "./entities/inventory.entity"
import { IInventoryRepository } from "./interfaces/inventory.repository.interface"
import { IInventoryVariantRepository } from "../inventory-variant/interfaces/inventory-variant.repository.interface"
import { IInventoryStockRepository } from "../inventory-stock/interfaces/inventory-stock.repository.interface"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { CreateInventoryValidator, UpdateInventoryValidator } from "./validators/inventory.validator"
import { STOCK_CONDITIONS } from "../../core/enums"

export class InventoryService {
    constructor(
        private readonly repository: IInventoryRepository,
        private readonly variantRepository: IInventoryVariantRepository,
        private readonly stockRepository: IInventoryStockRepository
    ) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC') {
        return await this.repository.findAll(page, limit, q, sortBy, order)
    }

    async getList() {
        return await this.repository.findList()
    }

    async getById(id: number): Promise<Inventory> {
        const product = await this.repository.findById(id)
        if (!product) throw new NotFoundException("Inventory item not found")
        return product
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

            for (const label of data.labels ?? []) {
                await this.repository.saveLabel({ inventoryId: item.id, key: label.key, value: label.value }, manager)
            }

            for (const v of data.variants ?? []) {
                const variant = await this.variantRepository.save({
                    inventoryId: item.id,
                    name: v.name,
                    code: v.code ?? null,
                    isActive: true,
                }, manager)

                for (const s of v.initialStock ?? []) {
                    for (const condition of STOCK_CONDITIONS) {
                        const qty = condition === "new" ? s.new : s.used
                        if (qty <= 0) continue
                        await this.stockRepository.saveBalance({
                            branchId: s.branchId, variantId: variant.id, condition, quantity: qty,
                        }, manager)
                        await this.stockRepository.saveMovement({
                            variantId: variant.id, branchId: s.branchId, condition,
                            type: "entry", quantity: qty, balanceAfter: qty,
                            note: "Initial stock", createdByUserId: userId ?? null,
                        }, manager)
                    }
                }
            }

            return item
        })

        return await this.getById(created.id)
    }

    async update(id: number, data: UpdateInventoryValidator): Promise<Inventory> {
        const product = await this.getById(id)
        this.repository.merge(product, {
            ...(data.code !== undefined ? { code: data.code ?? null } : {}),
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description ?? null } : {}),
            ...(data.image !== undefined ? { image: data.image ?? null } : {}),
            ...(data.unit !== undefined ? { unit: data.unit || "Pcs" } : {}),
            ...(data.subCategoryId !== undefined ? { subCategoryId: data.subCategoryId ?? null } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        })
        await this.repository.save(product)

        if (data.labels !== undefined) {
            await this.repository.deleteLabels(id)
            for (const label of data.labels) {
                await this.repository.saveLabel({ inventoryId: id, key: label.key, value: label.value })
            }
        }

        return await this.getById(id)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        const variantCount = await this.repository.countVariants(id)
        if (variantCount > 0) {
            throw new ConflictException("Cannot delete an item that still has variants")
        }
        await this.repository.delete(id)
    }
}
