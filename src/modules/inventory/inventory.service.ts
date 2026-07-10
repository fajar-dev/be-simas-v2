import { Inventory } from "./entities/inventory.entity"
import { IInventoryRepository } from "./interfaces/inventory.repository.interface"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { CreateInventoryValidator, UpdateInventoryValidator } from "./validators/inventory.validator"

export class InventoryService {
    constructor(private readonly repository: IInventoryRepository) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC') {
        return await this.repository.findAll(page, limit, q, sortBy, order)
    }

    async getList() {
        return await this.repository.findList()
    }

    async getById(id: number): Promise<Inventory> {
        const product = await this.repository.findById(id)
        if (!product) throw new NotFoundException("Stock product not found")
        return product
    }

    async create(data: CreateInventoryValidator, userId?: number): Promise<Inventory> {
        return await this.repository.save({
            code: data.code ?? null,
            name: data.name,
            description: data.description ?? null,
            isActive: data.isActive ?? true,
            createdByUserId: userId ?? null,
        })
    }

    async update(id: number, data: UpdateInventoryValidator): Promise<Inventory> {
        const product = await this.getById(id)
        this.repository.merge(product, {
            ...(data.code !== undefined ? { code: data.code ?? null } : {}),
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description ?? null } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        })
        return await this.repository.save(product)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        const variantCount = await this.repository.countVariants(id)
        if (variantCount > 0) {
            throw new ConflictException("Cannot delete a product that still has variants")
        }
        await this.repository.delete(id)
    }
}
