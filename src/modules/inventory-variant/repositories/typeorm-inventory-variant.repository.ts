import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryVariant } from "../entities/inventory-variant.entity"
import { InventoryStockBalance } from "../../inventory-stock/entities/inventory-stock-balance.entity"
import { IInventoryVariantRepository } from "../interfaces/inventory-variant.repository.interface"

export class TypeOrmInventoryVariantRepository implements IInventoryVariantRepository {
    private readonly repository: Repository<InventoryVariant>

    constructor() {
        this.repository = AppDataSource.getRepository(InventoryVariant)
    }

    async findByInventory(inventoryId: number): Promise<InventoryVariant[]> {
        return await this.repository.find({ where: { inventoryId }, order: { id: "ASC" } })
    }

    async findById(id: number): Promise<InventoryVariant | null> {
        return await this.repository.findOne({ where: { id }, relations: ["inventory"] })
    }

    async countBalances(variantId: number): Promise<number> {
        return await AppDataSource.getRepository(InventoryStockBalance).count({ where: { variantId } })
    }

    async save(data: Partial<InventoryVariant>, manager?: EntityManager): Promise<InventoryVariant> {
        const repo = manager ? manager.getRepository(InventoryVariant) : this.repository
        return await repo.save(data)
    }

    merge(entity: InventoryVariant, data: Partial<InventoryVariant>): InventoryVariant {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
