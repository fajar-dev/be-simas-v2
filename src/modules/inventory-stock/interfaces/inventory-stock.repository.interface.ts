import { EntityManager } from "typeorm"
import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { StockCondition } from "../../../core/enums"

export interface InventoryStockBalanceFilter {
    branchId?: number
    inventoryId?: number
    variantId?: number
    condition?: StockCondition
}

export interface InventoryStockOutFilter {
    inventoryId?: number
    variantId?: number
    employeeId?: number
    branchId?: number
    /** When true, only rows still "in play": employee-type with a remaining quantity, or any "other"-type row (always relevant, never stale). */
    active?: boolean
}

export interface IInventoryStockRepository {
    findBalances(page: number, limit: number, filters: InventoryStockBalanceFilter): Promise<{ data: InventoryStockBalance[]; total: number }>
    findBalancesByBranchAndVariants(branchId: number, variantIds: number[]): Promise<InventoryStockBalance[]>
    findBalance(branchId: number, variantId: number, condition: StockCondition, manager?: EntityManager, lock?: boolean): Promise<InventoryStockBalance | null>
    saveBalance(data: Partial<InventoryStockBalance>, manager?: EntityManager): Promise<InventoryStockBalance>
    saveStockOut(data: Partial<InventoryStockOut>, manager?: EntityManager): Promise<InventoryStockOut>
    /** Employee's stock-outs for a variant that still have a remaining quantity, oldest first (FIFO). */
    findActiveStockOuts(employeeId: number, variantId: number, manager?: EntityManager, lock?: boolean): Promise<InventoryStockOut[]>
    findStockOuts(page: number, limit: number, filters: InventoryStockOutFilter): Promise<{ data: InventoryStockOut[]; total: number }>
}
