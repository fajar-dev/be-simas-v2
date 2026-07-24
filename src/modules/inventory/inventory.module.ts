import { TypeOrmInventoryRepository } from "./repositories/typeorm-inventory.repository"
import { TypeOrmInventoryVariantRepository } from "../inventory-variant/repositories/typeorm-inventory-variant.repository"
import { TypeOrmInventoryStockRepository } from "../inventory-stock/repositories/typeorm-inventory-stock.repository"
import { InventoryService } from "./inventory.service"
import { InventoryUtilService } from "./inventory-util.service"
import { InventoryController } from "./inventory.controller"
import { attachmentService } from "../attachment/attachment.module"
import { inventoryLogService } from "../inventory-log/inventory-log.module"

const inventoryRepository = new TypeOrmInventoryRepository()
const inventoryVariantRepository = new TypeOrmInventoryVariantRepository()
const inventoryStockRepository = new TypeOrmInventoryStockRepository()
export const inventoryService = new InventoryService(inventoryRepository, inventoryVariantRepository, inventoryStockRepository, attachmentService, inventoryLogService)
const inventoryUtilService = new InventoryUtilService()
export const inventoryController = new InventoryController(inventoryService, inventoryUtilService)
