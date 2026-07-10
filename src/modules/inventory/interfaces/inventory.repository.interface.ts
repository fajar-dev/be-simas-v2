import { EntityManager } from "typeorm"
import { Inventory } from "../entities/inventory.entity"

export interface IInventoryRepository {
    findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Inventory[]; total: number }>
    findList(): Promise<Inventory[]>
    findById(id: number): Promise<Inventory | null>
    countVariants(productId: number): Promise<number>
    save(data: Partial<Inventory>, manager?: EntityManager): Promise<Inventory>
    merge(entity: Inventory, data: Partial<Inventory>): Inventory
    delete(id: number): Promise<void>
}
