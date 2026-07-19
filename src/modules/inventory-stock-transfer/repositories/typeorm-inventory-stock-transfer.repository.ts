import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockTransfer } from "../entities/inventory-stock-transfer.entity"
import { InventoryStockTransferItem } from "../entities/inventory-stock-transfer-item.entity"
import { IInventoryStockTransferRepository } from "../interfaces/inventory-stock-transfer.repository.interface"

export class TypeOrmInventoryStockTransferRepository implements IInventoryStockTransferRepository {
    private readonly repository: Repository<InventoryStockTransfer>
    private readonly itemRepository: Repository<InventoryStockTransferItem>

    constructor() {
        this.repository = AppDataSource.getRepository(InventoryStockTransfer)
        this.itemRepository = AppDataSource.getRepository(InventoryStockTransferItem)
    }

    async save(data: Partial<InventoryStockTransfer>, manager?: EntityManager): Promise<InventoryStockTransfer> {
        const repo = manager ? manager.getRepository(InventoryStockTransfer) : this.repository
        return await repo.save(data)
    }

    async saveItem(data: Partial<InventoryStockTransferItem>, manager?: EntityManager): Promise<InventoryStockTransferItem> {
        const repo = manager ? manager.getRepository(InventoryStockTransferItem) : this.itemRepository
        return await repo.save(data)
    }

    async findAll(inventoryId: number, page: number, limit: number): Promise<{ data: InventoryStockTransfer[]; total: number }> {
        const idQuery = this.repository.createQueryBuilder("t")
            .select("t.id", "id")
            .where(qb => {
                const sub = qb.subQuery()
                    .select("ti.transfer_id")
                    .from(InventoryStockTransferItem, "ti")
                    .innerJoin("ti.variant", "vv")
                    .where("vv.inventory_id = :inventoryId")
                    .getQuery()
                return "t.id IN " + sub
            })
            .setParameter("inventoryId", inventoryId)
            .orderBy("t.id", "DESC")

        const total = await idQuery.getCount()
        const idRows = await idQuery.limit(limit).offset((page - 1) * limit).getRawMany<{ id: number }>()
        const ids = idRows.map(r => Number(r.id))
        if (!ids.length) return { data: [], total }

        const data = await this.repository.find({
            where: { id: In(ids) },
            relations: ["fromBranch", "toBranch", "items", "items.variant", "items.variant.inventory", "createdBy"],
            order: { id: "DESC" },
        })
        return { data, total }
    }
}
