import { TypeOrmInventoryStockRepository } from "./repositories/typeorm-inventory-stock.repository"
import { InventoryStockService } from "./inventory-stock.service"
import { InventoryStockController } from "./inventory-stock.controller"
import { inventoryVariantService } from "../inventory-variant/inventory-variant.module"
import { branchService } from "../branch/branch.module"
import { employeeService } from "../employee/employee.module"
import { inventoryService } from "../inventory/inventory.module"
import { attachmentService } from "../attachment/attachment.module"

const stockRepository = new TypeOrmInventoryStockRepository()
export const inventoryStockService = new InventoryStockService(stockRepository, inventoryVariantService, branchService, employeeService, inventoryService, attachmentService)
export const inventoryStockController = new InventoryStockController(inventoryStockService)
