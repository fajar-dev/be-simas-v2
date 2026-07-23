import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { IInventoryStockOutRepository, InventoryStockOutFilter } from "../interfaces/inventory-stock-out.repository.interface"

export class TypeOrmInventoryStockOutRepository implements IInventoryStockOutRepository {
    private readonly stockOutRepo: Repository<InventoryStockOut>

    constructor() {
        this.stockOutRepo = AppDataSource.getRepository(InventoryStockOut)
    }

    async saveStockOut(data: Partial<InventoryStockOut>, manager?: EntityManager): Promise<InventoryStockOut> {
        const repo = manager ? manager.getRepository(InventoryStockOut) : this.stockOutRepo
        return await repo.save(data)
    }

    async findActiveStockOuts(employeeId: number, variantId: number, manager?: EntityManager, lock = false): Promise<InventoryStockOut[]> {
        const repo = manager ? manager.getRepository(InventoryStockOut) : this.stockOutRepo
        const query = repo.createQueryBuilder("stockOut")
            .where("stockOut.employeeId = :employeeId AND stockOut.variantId = :variantId AND stockOut.quantity > stockOut.quantityReturned", { employeeId, variantId })
            .orderBy("stockOut.id", "ASC")
        if (lock && manager) query.setLock("pessimistic_write")
        return await query.getMany()
    }

    async findStockOuts(page: number, limit: number, filters: InventoryStockOutFilter): Promise<{ data: InventoryStockOut[]; total: number }> {
        const query = this.stockOutRepo.createQueryBuilder("stockOut")
            .leftJoinAndSelect("stockOut.variant", "variant")
            .leftJoinAndSelect("variant.inventory", "inventory")
            .leftJoinAndSelect("stockOut.employee", "employee")
            .leftJoinAndSelect("stockOut.branch", "branch")

        if (filters.variantId) query.andWhere("stockOut.variantId = :variantId", { variantId: filters.variantId })
        if (filters.employeeId) query.andWhere("stockOut.employeeId = :employeeId", { employeeId: filters.employeeId })
        if (filters.branchId) query.andWhere("stockOut.branchId = :branchId", { branchId: filters.branchId })
        if (filters.inventoryId) query.andWhere("variant.inventoryId = :inventoryId", { inventoryId: filters.inventoryId })
        // "Other"-type rows are one-way and never stale, so they're always shown; only
        // employee-type rows are excluded once fully returned.
        if (filters.active) query.andWhere("(stockOut.quantity > stockOut.quantityReturned OR stockOut.type = 'other')")

        const total = await query.getCount()
        const data = await query
            .orderBy("stockOut.returnedDate", "ASC")
            .addOrderBy("stockOut.id", "DESC")
            .skip((page - 1) * limit)
            .take(limit)
            .getMany()

        return { data, total }
    }
}
