import { EntityManager } from "typeorm"
import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryStockHolding } from "../entities/inventory-stock-holding.entity"
import { StockCondition } from "../../../core/enums"

export interface InventoryStockBalanceFilter {
    branchId?: number
    inventoryId?: number
    variantId?: number
    condition?: StockCondition
}

export interface InventoryStockHoldingFilter {
    inventoryId?: number
    variantId?: number
    employeeId?: number
    branchId?: number
    /** When true, only holdings that still have a remaining (unreturned) quantity. */
    active?: boolean
}

export interface IInventoryStockRepository {
    findBalances(page: number, limit: number, filters: InventoryStockBalanceFilter): Promise<{ data: InventoryStockBalance[]; total: number }>
    findBalancesByBranchAndVariants(branchId: number, variantIds: number[]): Promise<InventoryStockBalance[]>
    findBalance(branchId: number, variantId: number, condition: StockCondition, manager?: EntityManager, lock?: boolean): Promise<InventoryStockBalance | null>
    saveBalance(data: Partial<InventoryStockBalance>, manager?: EntityManager): Promise<InventoryStockBalance>
    saveHolding(data: Partial<InventoryStockHolding>, manager?: EntityManager): Promise<InventoryStockHolding>
    /** Employee's holdings for a variant that still have a remaining quantity, oldest first (FIFO). */
    findActiveHoldings(employeeId: number, variantId: number, manager?: EntityManager, lock?: boolean): Promise<InventoryStockHolding[]>
    findHoldings(page: number, limit: number, filters: InventoryStockHoldingFilter): Promise<{ data: InventoryStockHolding[]; total: number }>
}
