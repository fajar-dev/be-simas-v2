import { InventoryVariant } from "./entities/inventory-variant.entity"
import { IInventoryVariantRepository } from "./interfaces/inventory-variant.repository.interface"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { CreateInventoryVariantValidator, UpdateInventoryVariantValidator } from "./validators/inventory-variant.validator"
import { InventoryService } from "../inventory/inventory.service"

export class InventoryVariantService {
    constructor(
        private readonly repository: IInventoryVariantRepository,
        private readonly inventoryService: InventoryService
    ) {}

    async getByProduct(productId: number): Promise<InventoryVariant[]> {
        await this.inventoryService.getById(productId) // ensures product exists
        return await this.repository.findByProduct(productId)
    }

    async getById(id: number): Promise<InventoryVariant> {
        const variant = await this.repository.findById(id)
        if (!variant) throw new NotFoundException("Stock variant not found")
        return variant
    }

    async create(data: CreateInventoryVariantValidator): Promise<InventoryVariant> {
        await this.inventoryService.getById(data.productId)
        const saved = await this.repository.save({
            productId: data.productId,
            name: data.name,
            code: data.code ?? null,
            unit: data.unit || "pcs",
            isActive: data.isActive ?? true,
        })
        return await this.getById(saved.id)
    }

    async update(id: number, data: UpdateInventoryVariantValidator): Promise<InventoryVariant> {
        const variant = await this.getById(id)
        this.repository.merge(variant, {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.code !== undefined ? { code: data.code ?? null } : {}),
            ...(data.unit !== undefined ? { unit: data.unit } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        })
        await this.repository.save(variant)
        return await this.getById(id)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        const balanceCount = await this.repository.countBalances(id)
        if (balanceCount > 0) {
            throw new ConflictException("Cannot delete a variant that has stock records")
        }
        await this.repository.delete(id)
    }
}
