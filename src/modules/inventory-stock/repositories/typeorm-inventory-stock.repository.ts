import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { IInventoryStockRepository, InventoryStockBalanceFilter, InventoryStockOutFilter } from "../interfaces/inventory-stock.repository.interface"
import { StockCondition } from "../../../core/enums"

export class TypeOrmInventoryStockRepository implements IInventoryStockRepository {
    private readonly balanceRepo: Repository<InventoryStockBalance>
    private readonly stockOutRepo: Repository<InventoryStockOut>

    constructor() {
        this.balanceRepo = AppDataSource.getRepository(InventoryStockBalance)
        this.stockOutRepo = AppDataSource.getRepository(InventoryStockOut)
    }

    async findBalances(page: number, limit: number, filters: InventoryStockBalanceFilter): Promise<{ data: InventoryStockBalance[]; total: number }> {
        const query = this.balanceRepo.createQueryBuilder("balance")
            .leftJoinAndSelect("balance.branch", "branch")
            .leftJoinAndSelect("balance.variant", "variant")
            .leftJoinAndSelect("variant.inventory", "inventory")

        if (filters.branchId) query.andWhere("balance.branchId = :branchId", { branchId: filters.branchId })
        if (filters.variantId) query.andWhere("balance.variantId = :variantId", { variantId: filters.variantId })
        if (filters.condition) query.andWhere("balance.condition = :condition", { condition: filters.condition })
        if (filters.inventoryId) query.andWhere("variant.inventoryId = :inventoryId", { inventoryId: filters.inventoryId })

        const total = await query.getCount()
        const data = await query
            .orderBy("inventory.name", "ASC")
            .addOrderBy("variant.name", "ASC")
            .addOrderBy("balance.condition", "ASC")
            .skip((page - 1) * limit)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findBalancesByBranchAndVariants(branchId: number, variantIds: number[]): Promise<InventoryStockBalance[]> {
        if (variantIds.length === 0) return []
        return await this.balanceRepo.find({ where: { branchId, variantId: In(variantIds) } })
    }

    async findBalance(branchId: number, variantId: number, condition: StockCondition, manager?: EntityManager, lock = false): Promise<InventoryStockBalance | null> {
        const repo = manager ? manager.getRepository(InventoryStockBalance) : this.balanceRepo
        const query = repo.createQueryBuilder("balance")
            .where("balance.branchId = :branchId AND balance.variantId = :variantId AND balance.condition = :condition", { branchId, variantId, condition })
        if (lock && manager) query.setLock("pessimistic_write")
        return await query.getOne()
    }

    async saveBalance(data: Partial<InventoryStockBalance>, manager?: EntityManager): Promise<InventoryStockBalance> {
        const repo = manager ? manager.getRepository(InventoryStockBalance) : this.balanceRepo
        return await repo.save(data)
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
