import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryLog } from "../entities/inventory-log.entity"
import { IInventoryLogRepository } from "../interfaces/inventory-log.repository.interface"

export class TypeOrmInventoryLogRepository implements IInventoryLogRepository {
    private readonly repository: Repository<InventoryLog>

    constructor() {
        this.repository = AppDataSource.getRepository(InventoryLog)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        inventoryId?: number
    ): Promise<{ data: InventoryLog[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("log")
            .leftJoinAndSelect("log.createdBy", "createdBy")

        if (q) {
            query.where(
                "(log.description LIKE :q OR log.module LIKE :q OR log.action LIKE :q OR createdBy.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (inventoryId) {
            query.andWhere("log.inventoryId = :inventoryId", { inventoryId })
        }

        const total = await query.getCount()

        const sortColumnMap: Record<string, string> = {
            module: "log.module",
            action: "log.action",
            description: "log.description",
            createdBy: "createdBy.name",
            createdAt: "log.createdAt",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "log.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<InventoryLog | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["createdBy"],
        })
    }

    async save(data: Partial<InventoryLog>, manager?: EntityManager): Promise<InventoryLog> {
        const repo = manager ? manager.getRepository(InventoryLog) : this.repository
        return await repo.save(data)
    }
}
