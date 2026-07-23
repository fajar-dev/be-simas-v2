import { EntityManager } from "typeorm"
import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { InventoryStockOutItem } from "../entities/inventory-stock-out-item.entity"

export interface InventoryStockOutFilter {
    inventoryId?: number
    variantId?: number
    employeeId?: number
    branchId?: number
    /** When true, only documents still "in play": isEmployee=true with at least one item having a remaining quantity, or any isEmployee=false document (always relevant, never stale). */
    active?: boolean
}

export interface IInventoryStockOutRepository {
    save(data: Partial<InventoryStockOut>, manager?: EntityManager): Promise<InventoryStockOut>
    saveItem(data: Partial<InventoryStockOutItem>, manager?: EntityManager): Promise<InventoryStockOutItem>
    findById(id: number): Promise<InventoryStockOut | null>
    /** Employee's stock-out lines for a variant that still have a remaining quantity, oldest first (FIFO). */
    findActiveItems(employeeId: number, variantId: number, manager?: EntityManager, lock?: boolean): Promise<InventoryStockOutItem[]>
    findStockOuts(page: number, limit: number, filters: InventoryStockOutFilter): Promise<{ data: InventoryStockOut[]; total: number }>
}
