import { TypeOrmInventoryRepository } from "./repositories/typeorm-inventory.repository"
import { TypeOrmInventoryVariantRepository } from "../inventory-variant/repositories/typeorm-inventory-variant.repository"
import { TypeOrmInventoryStockRepository } from "../inventory-stock/repositories/typeorm-inventory-stock.repository"
import { InventoryService } from "./inventory.service"
import { InventoryController } from "./inventory.controller"

const inventoryRepository = new TypeOrmInventoryRepository()
const inventoryVariantRepository = new TypeOrmInventoryVariantRepository()
const inventoryStockRepository = new TypeOrmInventoryStockRepository()
export const inventoryService = new InventoryService(inventoryRepository, inventoryVariantRepository, inventoryStockRepository)
export const inventoryController = new InventoryController(inventoryService)
