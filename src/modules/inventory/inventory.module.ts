import { TypeOrmInventoryRepository } from "./repositories/typeorm-inventory.repository"
import { InventoryService } from "./inventory.service"
import { InventoryController } from "./inventory.controller"

const inventoryRepository = new TypeOrmInventoryRepository()
export const inventoryService = new InventoryService(inventoryRepository)
export const inventoryController = new InventoryController(inventoryService)
