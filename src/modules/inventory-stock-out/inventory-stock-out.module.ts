import { TypeOrmInventoryStockOutRepository } from "./repositories/typeorm-inventory-stock-out.repository"
import { InventoryStockOutService } from "./inventory-stock-out.service"
import { InventoryStockOutController } from "./inventory-stock-out.controller"
import { inventoryStockService } from "../inventory-stock/inventory-stock.module"
import { inventoryVariantService } from "../inventory-variant/inventory-variant.module"
import { branchService } from "../branch/branch.module"
import { employeeService } from "../employee/employee.module"
import { inventoryLogService } from "../inventory-log/inventory-log.module"
import { attachmentService } from "../attachment/attachment.module"

const inventoryStockOutRepository = new TypeOrmInventoryStockOutRepository()
export const inventoryStockOutService = new InventoryStockOutService(
    inventoryStockOutRepository,
    inventoryStockService,
    inventoryVariantService,
    branchService,
    employeeService,
    inventoryLogService,
    attachmentService
)
export const inventoryStockOutController = new InventoryStockOutController(inventoryStockOutService)
