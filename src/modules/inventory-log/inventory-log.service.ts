import { IInventoryLogRepository } from "./interfaces/inventory-log.repository.interface"
import { InventoryLog } from "./entities/inventory-log.entity"
import { EntityManager } from "typeorm"

export class InventoryLogService {
    constructor(private readonly repository: IInventoryLogRepository) {}

    async getAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        inventoryId?: number
    ): Promise<{ data: InventoryLog[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order, inventoryId)
    }

    async log(data: {
        inventoryId: number
        module: string
        action: string
        description: string
        createdByUserId?: number | null
        oldValue?: Record<string, any> | null
        newValue?: Record<string, any> | null
    }, manager?: EntityManager): Promise<InventoryLog> {
        return await this.repository.save({
            inventoryId: data.inventoryId,
            module: data.module,
            action: data.action,
            description: data.description,
            createdByUserId: data.createdByUserId,
            oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
            newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        }, manager)
    }
}
