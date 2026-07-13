import { EntityManager } from "typeorm"
import { InventoryStockBalance } from "../entities/inventory-stock-balance.entity"
import { InventoryStockMovement } from "../entities/inventory-stock-movement.entity"
import { InventoryStockHolding } from "../entities/inventory-stock-holding.entity"
import { InventoryStockTransfer } from "../entities/inventory-stock-transfer.entity"
import { InventoryStockTransferItem } from "../entities/inventory-stock-transfer-item.entity"
import { StockCondition } from "../../../core/enums"

export interface InventoryStockBalanceFilter {
    branchId?: number
    inventoryId?: number
    variantId?: number
    condition?: StockCondition
}

export interface InventoryStockMovementFilter {
    inventoryId?: number
    branchId?: number
    variantId?: number
    condition?: StockCondition
    type?: string
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
    saveMovement(data: Partial<InventoryStockMovement>, manager?: EntityManager): Promise<InventoryStockMovement>
    findMovements(page: number, limit: number, filters: InventoryStockMovementFilter): Promise<{ data: InventoryStockMovement[]; total: number }>
    saveHolding(data: Partial<InventoryStockHolding>, manager?: EntityManager): Promise<InventoryStockHolding>
    /** Employee's holdings for a variant that still have a remaining quantity, oldest first (FIFO). */
    findActiveHoldings(employeeId: number, variantId: number, manager?: EntityManager, lock?: boolean): Promise<InventoryStockHolding[]>
    findHoldings(page: number, limit: number, filters: InventoryStockHoldingFilter): Promise<{ data: InventoryStockHolding[]; total: number }>
    saveTransfer(data: Partial<InventoryStockTransfer>, manager?: EntityManager): Promise<InventoryStockTransfer>
    saveTransferItem(data: Partial<InventoryStockTransferItem>, manager?: EntityManager): Promise<InventoryStockTransferItem>
    findTransfers(inventoryId: number, page: number, limit: number): Promise<{ data: InventoryStockTransfer[]; total: number }>
}
