import { TypeOrmInventoryLogRepository } from "./repositories/typeorm-inventory-log.repository"
import { InventoryLogService } from "./inventory-log.service"
import { InventoryLogController } from "./inventory-log.controller"

const inventoryLogRepository = new TypeOrmInventoryLogRepository()
export const inventoryLogService = new InventoryLogService(inventoryLogRepository)
export const inventoryLogController = new InventoryLogController(inventoryLogService)
