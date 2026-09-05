import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockOpname } from "../entities/inventory-stock-opname.entity"
import { InventoryStockOpnameItem } from "../entities/inventory-stock-opname-item.entity"
import { IInventoryStockOpnameRepository } from "../interfaces/inventory-stock-opname.repository.interface"

export class TypeOrmInventoryStockOpnameRepository implements IInventoryStockOpnameRepository {
    private readonly repository: Repository<InventoryStockOpname>
    private readonly itemRepository: Repository<InventoryStockOpnameItem>

    constructor() {
        this.repository = AppDataSource.getRepository(InventoryStockOpname)
        this.itemRepository = AppDataSource.getRepository(InventoryStockOpnameItem)
    }

    async save(data: Partial<InventoryStockOpname>, manager?: EntityManager): Promise<InventoryStockOpname> {
        const repo = manager ? manager.getRepository(InventoryStockOpname) : this.repository
        return await repo.save(data)
    }

    async saveItem(data: Partial<InventoryStockOpnameItem>, manager?: EntityManager): Promise<InventoryStockOpnameItem> {
        const repo = manager ? manager.getRepository(InventoryStockOpnameItem) : this.itemRepository
        return await repo.save(data)
    }

    async findAll(inventoryId: number, page: number, limit: number): Promise<{ data: InventoryStockOpname[]; total: number }> {
        const idQuery = this.repository.createQueryBuilder("s")
            .select("s.id", "id")
            .where(qb => {
                const sub = qb.subQuery()
                    .select("si.opname_id")
                    .from(InventoryStockOpnameItem, "si")
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
            relations: ["branch", "createdBy", "items", "items.variant", "items.variant.inventory"],
            order: { id: "DESC" },
        })
        return { data, total }
    }

    async findById(id: number): Promise<InventoryStockOpname | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["branch", "createdBy", "items", "items.variant", "items.variant.inventory"],
        })
    }
}
