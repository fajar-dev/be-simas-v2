import { EntityManager } from "typeorm"
import { InventoryVariant } from "../entities/inventory-variant.entity"

export interface IInventoryVariantRepository {
    findByInventory(inventoryId: number): Promise<InventoryVariant[]>
    findById(id: number): Promise<InventoryVariant | null>
    countBalances(variantId: number): Promise<number>
    save(data: Partial<InventoryVariant>, manager?: EntityManager): Promise<InventoryVariant>
    merge(entity: InventoryVariant, data: Partial<InventoryVariant>): InventoryVariant
    delete(id: number): Promise<void>
}
