import { EntityManager } from "typeorm"
import { Inventory } from "../entities/inventory.entity"
import { InventoryLabel } from "../entities/inventory-label.entity"

export interface InventoryFilter {
    categoryIds?: number[]
    subCategoryIds?: number[]
    units?: string[]
    isActive?: boolean
    variantStatus?: 'has_variants' | 'no_variants'
    newStockMin?: number
    newStockMax?: number
    usedStockMin?: number
    usedStockMax?: number
    missingFields?: string[]
    labels?: { key: string; value: string }[]
}

export interface IInventoryRepository {
    findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: InventoryFilter): Promise<{ data: Inventory[]; total: number }>
    findList(): Promise<Inventory[]>
    findById(id: number): Promise<Inventory | null>
    countVariants(inventoryId: number): Promise<number>
    save(data: Partial<Inventory>, manager?: EntityManager): Promise<Inventory>
    merge(entity: Inventory, data: Partial<Inventory>): Inventory
    delete(id: number): Promise<void>
    saveLabel(data: Partial<InventoryLabel>, manager?: EntityManager): Promise<InventoryLabel>
    deleteLabels(inventoryId: number, manager?: EntityManager): Promise<void>
    /** Distinct label keys across all inventory items (for the list's custom-label columns). */
    findLabelKeys(): Promise<string[]>
}
