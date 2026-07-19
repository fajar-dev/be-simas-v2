import { TypeOrmInventoryStockTransferRepository } from "./repositories/typeorm-inventory-stock-transfer.repository"
import { InventoryStockTransferService } from "./inventory-stock-transfer.service"
import { InventoryStockTransferController } from "./inventory-stock-transfer.controller"
import { inventoryStockService } from "../inventory-stock/inventory-stock.module"
import { inventoryVariantService } from "../inventory-variant/inventory-variant.module"
import { branchService } from "../branch/branch.module"
import { inventoryService } from "../inventory/inventory.module"
import { attachmentService } from "../attachment/attachment.module"
import { inventoryLogService } from "../inventory-log/inventory-log.module"

const inventoryStockTransferRepository = new TypeOrmInventoryStockTransferRepository()
export const inventoryStockTransferService = new InventoryStockTransferService(
    inventoryStockTransferRepository,
    inventoryStockService,
    inventoryVariantService,
    branchService,
    inventoryService,
    attachmentService,
    inventoryLogService
)
export const inventoryStockTransferController = new InventoryStockTransferController(inventoryStockTransferService)
