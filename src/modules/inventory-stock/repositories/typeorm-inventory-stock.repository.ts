import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { IInventoryStockRepository, InventoryStockBalanceFilter } from "../interfaces/inventory-stock.repository.interface"
import { StockCondition } from "../../../core/enums"

export class TypeOrmInventoryStockRepository implements IInventoryStockRepository {
    private readonly balanceRepo: Repository<InventoryStockBalance>

    constructor() {
        this.balanceRepo = AppDataSource.getRepository(InventoryStockBalance)
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
}
