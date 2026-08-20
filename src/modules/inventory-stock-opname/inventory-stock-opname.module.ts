import { TypeOrmInventoryStockOpnameRepository } from "./repositories/typeorm-inventory-stock-opname.repository"
import { InventoryStockOpnameService } from "./inventory-stock-opname.service"
import { InventoryStockOpnameController } from "./inventory-stock-opname.controller"
import { inventoryStockService } from "../inventory-stock/inventory-stock.module"
import { inventoryVariantService } from "../inventory-variant/inventory-variant.module"
import { branchService } from "../branch/branch.module"
import { inventoryService } from "../inventory/inventory.module"
import { attachmentService } from "../attachment/attachment.module"
import { inventoryLogService } from "../inventory-log/inventory-log.module"

const inventoryStockOpnameRepository = new TypeOrmInventoryStockOpnameRepository()
export const inventoryStockOpnameService = new InventoryStockOpnameService(
    inventoryStockOpnameRepository,
    inventoryStockService,
    inventoryVariantService,
    branchService,
    inventoryService,
    attachmentService,
    inventoryLogService
)
export const inventoryStockOpnameController = new InventoryStockOpnameController(inventoryStockOpnameService)
