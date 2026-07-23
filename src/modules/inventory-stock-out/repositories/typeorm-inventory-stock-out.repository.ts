import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { InventoryStockOutItem } from "../entities/inventory-stock-out-item.entity"
import { IInventoryStockOutRepository, InventoryStockOutFilter } from "../interfaces/inventory-stock-out.repository.interface"

export class TypeOrmInventoryStockOutRepository implements IInventoryStockOutRepository {
    private readonly repository: Repository<InventoryStockOut>
    private readonly itemRepository: Repository<InventoryStockOutItem>

    constructor() {
        this.repository = AppDataSource.getRepository(InventoryStockOut)
        this.itemRepository = AppDataSource.getRepository(InventoryStockOutItem)
    }

    async save(data: Partial<InventoryStockOut>, manager?: EntityManager): Promise<InventoryStockOut> {
        const repo = manager ? manager.getRepository(InventoryStockOut) : this.repository
        return await repo.save(data)
    }

    async saveItem(data: Partial<InventoryStockOutItem>, manager?: EntityManager): Promise<InventoryStockOutItem> {
        const repo = manager ? manager.getRepository(InventoryStockOutItem) : this.itemRepository
        return await repo.save(data)
    }

    async findById(id: number): Promise<InventoryStockOut | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["employee", "createdBy", "items", "items.variant", "items.variant.inventory", "items.branch"],
        })
    }

    async findActiveItems(employeeId: number, variantId: number, manager?: EntityManager, lock = false): Promise<InventoryStockOutItem[]> {
        const repo = manager ? manager.getRepository(InventoryStockOutItem) : this.itemRepository
        const query = repo.createQueryBuilder("item")
            .innerJoin("item.stockOut", "stockOut")
            .where("stockOut.employeeId = :employeeId AND item.variantId = :variantId AND item.quantity > item.quantityReturned", { employeeId, variantId })
            .orderBy("stockOut.createdAt", "ASC")
            .addOrderBy("item.id", "ASC")
        if (lock && manager) query.setLock("pessimistic_write")
        return await query.getMany()
    }

    async findStockOuts(page: number, limit: number, filters: InventoryStockOutFilter): Promise<{ data: InventoryStockOut[]; total: number }> {
        const idQuery = this.repository.createQueryBuilder("s")
            .select("s.id", "id")

        if (filters.employeeId) idQuery.andWhere("s.employeeId = :employeeId", { employeeId: filters.employeeId })

        if (filters.inventoryId || filters.variantId || filters.branchId) {
            idQuery.andWhere((qb) => {
                const sub = qb.subQuery()
                    .select("si.stock_out_id")
                    .from(InventoryStockOutItem, "si")
                    .innerJoin("si.variant", "vv")
                if (filters.inventoryId) sub.andWhere("vv.inventory_id = :inventoryId", { inventoryId: filters.inventoryId })
                if (filters.variantId) sub.andWhere("si.variant_id = :variantId", { variantId: filters.variantId })
                if (filters.branchId) sub.andWhere("si.branch_id = :branchId", { branchId: filters.branchId })
                return "s.id IN " + sub.getQuery()
            })
        }

        if (filters.active) {
            // "Other"-type documents are one-way and never stale, so they're always shown;
            // "employee"-type documents are only shown while at least one item still has a remaining quantity.
            idQuery.andWhere((qb) => {
                const sub = qb.subQuery()
                    .select("1")
                    .from(InventoryStockOutItem, "ai")
                    .where("ai.stock_out_id = s.id AND ai.quantity > ai.quantity_returned")
                    .getQuery()
                return `(s.type = 'other' OR EXISTS ${sub})`
            })
        }

        idQuery.orderBy("s.id", "DESC")

        const total = await idQuery.getCount()
        const idRows = await idQuery.limit(limit).offset((page - 1) * limit).getRawMany<{ id: number }>()
        const ids = idRows.map((r) => Number(r.id))
        if (!ids.length) return { data: [], total }

        const data = await this.repository.find({
            where: { id: In(ids) },
            relations: ["employee", "createdBy", "items", "items.variant", "items.variant.inventory", "items.branch"],
            order: { id: "DESC" },
        })
        return { data, total }
    }
}
