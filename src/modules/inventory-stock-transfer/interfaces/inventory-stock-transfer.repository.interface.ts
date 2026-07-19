import { EntityManager } from "typeorm"
import { InventoryStockTransfer } from "../entities/inventory-stock-transfer.entity"
import { InventoryStockTransferItem } from "../entities/inventory-stock-transfer-item.entity"

export interface IInventoryStockTransferRepository {
    save(data: Partial<InventoryStockTransfer>, manager?: EntityManager): Promise<InventoryStockTransfer>
    saveItem(data: Partial<InventoryStockTransferItem>, manager?: EntityManager): Promise<InventoryStockTransferItem>
    /** Transfers with at least one item belonging to the given inventory item's variants, paginated. */
    findAll(inventoryId: number, page: number, limit: number): Promise<{ data: InventoryStockTransfer[]; total: number }>
}
