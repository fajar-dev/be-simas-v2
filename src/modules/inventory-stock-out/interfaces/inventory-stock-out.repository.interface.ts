import { EntityManager } from "typeorm"
import { InventoryStockOut } from "../entities/inventory-stock-out.entity"

export interface InventoryStockOutFilter {
    inventoryId?: number
    variantId?: number
    employeeId?: number
    branchId?: number
    /** When true, only rows still "in play": employee-type with a remaining quantity, or any "other"-type row (always relevant, never stale). */
    active?: boolean
}

export interface IInventoryStockOutRepository {
    saveStockOut(data: Partial<InventoryStockOut>, manager?: EntityManager): Promise<InventoryStockOut>
    /** Employee's stock-outs for a variant that still have a remaining quantity, oldest first (FIFO). */
    findActiveStockOuts(employeeId: number, variantId: number, manager?: EntityManager, lock?: boolean): Promise<InventoryStockOut[]>
    findStockOuts(page: number, limit: number, filters: InventoryStockOutFilter): Promise<{ data: InventoryStockOut[]; total: number }>
}
