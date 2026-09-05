import { TypeOrmInventoryVariantRepository } from "./repositories/typeorm-inventory-variant.repository"
import { InventoryVariantService } from "./inventory-variant.service"
import { InventoryVariantController } from "./inventory-variant.controller"
import { inventoryService } from "../inventory/inventory.module"

const inventoryVariantRepository = new TypeOrmInventoryVariantRepository()
export const inventoryVariantService = new InventoryVariantService(inventoryVariantRepository, inventoryService)
export const inventoryVariantController = new InventoryVariantController(inventoryVariantService)
