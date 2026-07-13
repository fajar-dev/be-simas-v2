import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Inventory } from "../entities/inventory.entity"
import { InventoryLabel } from "../entities/inventory-label.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { IInventoryRepository } from "../interfaces/inventory.repository.interface"

const RELATIONS = ["createdBy", "subCategory", "subCategory.category", "labels"]

export class TypeOrmInventoryRepository implements IInventoryRepository {
    private readonly repository: Repository<Inventory>
    private readonly labelRepository: Repository<InventoryLabel>

    constructor() {
        this.repository = AppDataSource.getRepository(Inventory)
        this.labelRepository = AppDataSource.getRepository(InventoryLabel)
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Inventory[]; total: number }> {
        const query = this.repository.createQueryBuilder("item")
            .leftJoinAndSelect("item.createdBy", "createdBy")
            .leftJoinAndSelect("item.subCategory", "subCategory")
            .leftJoinAndSelect("subCategory.category", "category")
            .leftJoinAndSelect("item.labels", "labels")

        if (q) {
            query.where("(item.code LIKE :q OR item.name LIKE :q OR item.description LIKE :q)", { q: `%${q}%` })
        }

        const total = await query.getCount()

        const sortColumnMap: Record<string, string> = {
            code: "item.code",
            name: "item.name",
            createdAt: "item.createdAt",
        }
        const sortColumn = sortColumnMap[sortBy || ''] || "item.id"
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
        return await this.repository.findOne({ where: { id }, relations: RELATIONS })
    }

    async countVariants(inventoryId: number): Promise<number> {
        return await AppDataSource.getRepository(InventoryVariant).count({ where: { inventoryId } })
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

    async saveLabel(data: Partial<InventoryLabel>, manager?: EntityManager): Promise<InventoryLabel> {
        const repo = manager ? manager.getRepository(InventoryLabel) : this.labelRepository
        return await repo.save(data)
    }

    async deleteLabels(inventoryId: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(InventoryLabel) : this.labelRepository
        await repo.delete({ inventoryId })
    }

    async findLabelKeys(): Promise<string[]> {
        const rows = await this.labelRepository.createQueryBuilder("label")
            .select("DISTINCT label.key", "key")
            .orderBy("label.key", "ASC")
            .getRawMany<{ key: string }>()
        return rows.map((r) => r.key)
    }
}
