import { InventoryLog } from "../entities/inventory-log.entity"
import { EntityManager } from "typeorm"

export interface IInventoryLogRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        inventoryId?: number
    ): Promise<{ data: InventoryLog[]; total: number }>
    findById(id: number): Promise<InventoryLog | null>
    save(data: Partial<InventoryLog>, manager?: EntityManager): Promise<InventoryLog>
}
