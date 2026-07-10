import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Inventory } from "../entities/inventory.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { IInventoryRepository } from "../interfaces/inventory.repository.interface"

export class TypeOrmInventoryRepository implements IInventoryRepository {
    private readonly repository: Repository<Inventory>

    constructor() {
        this.repository = AppDataSource.getRepository(Inventory)
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Inventory[]; total: number }> {
        const query = this.repository.createQueryBuilder("product")
            .leftJoinAndSelect("product.createdBy", "createdBy")

        if (q) {
            query.where("(product.code LIKE :q OR product.name LIKE :q OR product.description LIKE :q)", { q: `%${q}%` })
        }

        const total = await query.getCount()

        const sortColumnMap: Record<string, string> = {
            code: "product.code",
            name: "product.name",
            createdAt: "product.createdAt",
        }
        const sortColumn = sortColumnMap[sortBy || ''] || "product.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip((page - 1) * limit)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findList(): Promise<Inventory[]> {
        return await this.repository.find({ where: { isActive: true }, order: { name: "ASC" } })
    }

    async findById(id: number): Promise<Inventory | null> {
        return await this.repository.findOne({ where: { id }, relations: ["createdBy"] })
    }

    async countVariants(productId: number): Promise<number> {
        return await AppDataSource.getRepository(InventoryVariant).count({ where: { productId } })
    }

    async save(data: Partial<Inventory>, manager?: EntityManager): Promise<Inventory> {
        const repo = manager ? manager.getRepository(Inventory) : this.repository
        return await repo.save(data)
    }

    merge(entity: Inventory, data: Partial<Inventory>): Inventory {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
