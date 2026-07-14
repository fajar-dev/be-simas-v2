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

    async getByInventory(inventoryId: number): Promise<InventoryVariant[]> {
        await this.inventoryService.getById(inventoryId) // ensures the item exists
        return await this.repository.findByInventory(inventoryId)
    }

    async getById(id: number): Promise<InventoryVariant> {
        const variant = await this.repository.findById(id)
        if (!variant) throw new NotFoundException("Inventory variant not found")
        return variant
    }

    async create(data: CreateInventoryVariantValidator): Promise<InventoryVariant> {
        await this.inventoryService.getById(data.inventoryId)
        const saved = await this.repository.save({
            inventoryId: data.inventoryId,
            name: data.name,
            code: data.code ?? null,
            image: data.image ?? null,
            description: data.description ?? null,
            isActive: data.isActive ?? true,
        })
        // Auto-fill code from the generated id when left empty (like category).
        if (!data.code) {
            saved.code = String(saved.id)
            await this.repository.save(saved)
        }
        return await this.getById(saved.id)
    }

    async update(id: number, data: UpdateInventoryVariantValidator): Promise<InventoryVariant> {
        const variant = await this.getById(id)
        this.repository.merge(variant, {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.code !== undefined ? { code: data.code ?? null } : {}),
            ...(data.image !== undefined ? { image: data.image ?? null } : {}),
            ...(data.description !== undefined ? { description: data.description ?? null } : {}),
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
