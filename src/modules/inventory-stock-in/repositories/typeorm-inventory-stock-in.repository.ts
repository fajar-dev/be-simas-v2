import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockIn } from "../entities/inventory-stock-in.entity"
import { InventoryStockInItem } from "../entities/inventory-stock-in-item.entity"
import { IInventoryStockInRepository } from "../interfaces/inventory-stock-in.repository.interface"

export class TypeOrmInventoryStockInRepository implements IInventoryStockInRepository {
    private readonly repository: Repository<InventoryStockIn>
    private readonly itemRepository: Repository<InventoryStockInItem>

    constructor() {
        this.repository = AppDataSource.getRepository(InventoryStockIn)
        this.itemRepository = AppDataSource.getRepository(InventoryStockInItem)
    }

    async save(data: Partial<InventoryStockIn>, manager?: EntityManager): Promise<InventoryStockIn> {
        const repo = manager ? manager.getRepository(InventoryStockIn) : this.repository
        return await repo.save(data)
    }

    async saveItem(data: Partial<InventoryStockInItem>, manager?: EntityManager): Promise<InventoryStockInItem> {
        const repo = manager ? manager.getRepository(InventoryStockInItem) : this.itemRepository
        return await repo.save(data)
    }

    async findAll(inventoryId: number, page: number, limit: number): Promise<{ data: InventoryStockIn[]; total: number }> {
        const idQuery = this.repository.createQueryBuilder("s")
            .select("s.id", "id")
            .where(qb => {
                const sub = qb.subQuery()
                    .select("si.stock_in_id")
                    .from(InventoryStockInItem, "si")
                    .innerJoin("si.variant", "vv")
                    .where("vv.inventory_id = :inventoryId")
                    .getQuery()
                return "s.id IN " + sub
            })
            .setParameter("inventoryId", inventoryId)
            .orderBy("s.id", "DESC")

        const total = await idQuery.getCount()
        const idRows = await idQuery.limit(limit).offset((page - 1) * limit).getRawMany<{ id: number }>()
        const ids = idRows.map(r => Number(r.id))
        if (!ids.length) return { data: [], total }

        const data = await this.repository.find({
            where: { id: In(ids) },
            relations: ["createdBy", "items", "items.variant", "items.variant.inventory", "items.branch"],
            order: { id: "DESC" },
        })
        return { data, total }
    }

    async findById(id: number): Promise<InventoryStockIn | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["createdBy", "items", "items.variant", "items.variant.inventory", "items.branch"],
        })
    }
}
