import { EntityManager } from "typeorm"
import { InventoryStockOpname } from "../entities/inventory-stock-opname.entity"
import { InventoryStockOpnameItem } from "../entities/inventory-stock-opname-item.entity"

export interface IInventoryStockOpnameRepository {
    save(data: Partial<InventoryStockOpname>, manager?: EntityManager): Promise<InventoryStockOpname>
    saveItem(data: Partial<InventoryStockOpnameItem>, manager?: EntityManager): Promise<InventoryStockOpnameItem>
    /** Opnames with at least one item belonging to the given inventory item's variants, paginated. */
    findAll(inventoryId: number, page: number, limit: number): Promise<{ data: InventoryStockOpname[]; total: number }>
    findById(id: number): Promise<InventoryStockOpname | null>
}
