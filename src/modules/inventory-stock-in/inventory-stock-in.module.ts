import { TypeOrmInventoryStockInRepository } from "./repositories/typeorm-inventory-stock-in.repository"
import { InventoryStockInService } from "./inventory-stock-in.service"
import { InventoryStockInController } from "./inventory-stock-in.controller"
import { inventoryStockService } from "../inventory-stock/inventory-stock.module"
import { inventoryVariantService } from "../inventory-variant/inventory-variant.module"
import { branchService } from "../branch/branch.module"
import { inventoryService } from "../inventory/inventory.module"
import { attachmentService } from "../attachment/attachment.module"
import { inventoryLogService } from "../inventory-log/inventory-log.module"

const inventoryStockInRepository = new TypeOrmInventoryStockInRepository()
export const inventoryStockInService = new InventoryStockInService(
    inventoryStockInRepository,
    inventoryStockService,
    inventoryVariantService,
    branchService,
    inventoryService,
    attachmentService,
    inventoryLogService
)
export const inventoryStockInController = new InventoryStockInController(inventoryStockInService)
