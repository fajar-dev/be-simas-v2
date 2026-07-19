import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryStockHolding } from "../entities/inventory-stock-holding.entity"
import { IInventoryStockRepository, InventoryStockBalanceFilter, InventoryStockHoldingFilter } from "../interfaces/inventory-stock.repository.interface"
import { StockCondition } from "../../../core/enums"

export class TypeOrmInventoryStockRepository implements IInventoryStockRepository {
    private readonly balanceRepo: Repository<InventoryStockBalance>
    private readonly holdingRepo: Repository<InventoryStockHolding>

    constructor() {
        this.balanceRepo = AppDataSource.getRepository(InventoryStockBalance)
        this.holdingRepo = AppDataSource.getRepository(InventoryStockHolding)
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

    async saveHolding(data: Partial<InventoryStockHolding>, manager?: EntityManager): Promise<InventoryStockHolding> {
        const repo = manager ? manager.getRepository(InventoryStockHolding) : this.holdingRepo
        return await repo.save(data)
    }

    async findActiveHoldings(employeeId: number, variantId: number, manager?: EntityManager, lock = false): Promise<InventoryStockHolding[]> {
        const repo = manager ? manager.getRepository(InventoryStockHolding) : this.holdingRepo
        const query = repo.createQueryBuilder("holding")
            .where("holding.employeeId = :employeeId AND holding.variantId = :variantId AND holding.quantity > holding.quantityReturned", { employeeId, variantId })
            .orderBy("holding.id", "ASC")
        if (lock && manager) query.setLock("pessimistic_write")
        return await query.getMany()
    }

    async findHoldings(page: number, limit: number, filters: InventoryStockHoldingFilter): Promise<{ data: InventoryStockHolding[]; total: number }> {
        const query = this.holdingRepo.createQueryBuilder("holding")
            .leftJoinAndSelect("holding.variant", "variant")
            .leftJoinAndSelect("variant.inventory", "inventory")
            .leftJoinAndSelect("holding.employee", "employee")
            .leftJoinAndSelect("holding.branch", "branch")

        if (filters.variantId) query.andWhere("holding.variantId = :variantId", { variantId: filters.variantId })
        if (filters.employeeId) query.andWhere("holding.employeeId = :employeeId", { employeeId: filters.employeeId })
        if (filters.branchId) query.andWhere("holding.branchId = :branchId", { branchId: filters.branchId })
        if (filters.inventoryId) query.andWhere("variant.inventoryId = :inventoryId", { inventoryId: filters.inventoryId })
        if (filters.active) query.andWhere("holding.quantity > holding.quantityReturned")

        const total = await query.getCount()
        const data = await query
            .orderBy("holding.returnedDate", "ASC")
            .addOrderBy("holding.id", "DESC")
            .skip((page - 1) * limit)
            .take(limit)
            .getMany()

        return { data, total }
    }
}
