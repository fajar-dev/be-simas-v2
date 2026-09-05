import { InventoryLog } from "../entities/inventory-log.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class InventoryLogSerializer {

    static async single(log: InventoryLog) {
        return {
            id: log.id,
            inventoryId: log.inventoryId,
            module: log.module,
            action: log.action,
            description: log.description,
            createdAt: log.createdAt,
            createdBy: log.createdBy ? {
                id: log.createdBy.id,
                name: log.createdBy.name,
                photo: await resolveFileUrl(log.createdBy.photo),
                email: log.createdBy.email
            } : null
        }
    }

    static async collection(logs: InventoryLog[]) {
        return Promise.all(logs.map(log => this.single(log)))
    }
}
