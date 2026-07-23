import { EntityManager } from "typeorm"
import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { StockCondition } from "../../../core/enums"

export interface InventoryStockBalanceFilter {
    branchId?: number
    inventoryId?: number
    variantId?: number
    condition?: StockCondition
}

export interface IInventoryStockRepository {
    findBalances(page: number, limit: number, filters: InventoryStockBalanceFilter): Promise<{ data: InventoryStockBalance[]; total: number }>
    findBalancesByBranchAndVariants(branchId: number, variantIds: number[]): Promise<InventoryStockBalance[]>
    findBalance(branchId: number, variantId: number, condition: StockCondition, manager?: EntityManager, lock?: boolean): Promise<InventoryStockBalance | null>
    saveBalance(data: Partial<InventoryStockBalance>, manager?: EntityManager): Promise<InventoryStockBalance>
}
