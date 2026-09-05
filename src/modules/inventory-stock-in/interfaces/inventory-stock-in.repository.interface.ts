import { EntityManager } from "typeorm"
import { InventoryStockIn } from "../entities/inventory-stock-in.entity"
import { InventoryStockInItem } from "../entities/inventory-stock-in-item.entity"

export interface IInventoryStockInRepository {
    save(data: Partial<InventoryStockIn>, manager?: EntityManager): Promise<InventoryStockIn>
    saveItem(data: Partial<InventoryStockInItem>, manager?: EntityManager): Promise<InventoryStockInItem>
    /** Stock-ins with at least one item belonging to the given inventory item's variants, paginated. */
    findAll(inventoryId: number, page: number, limit: number): Promise<{ data: InventoryStockIn[]; total: number }>
    findById(id: number): Promise<InventoryStockIn | null>
}
