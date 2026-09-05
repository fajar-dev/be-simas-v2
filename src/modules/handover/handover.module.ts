import { TypeOrmHandoverRepository } from "./repositories/typeorm-handover.repository"
import { HandoverService } from "./handover.service"
import { HandoverController } from "./handover.controller"
import { assetService } from "../asset/asset.module"
import { employeeService } from "../employee/employee.module"
import { assetHolderService } from "../asset-holder/asset-holder.module"
import { assetLogService } from "../asset-log/asset-log.module"
import { attachmentService } from "../attachment/attachment.module"
import { handoverFieldService } from "../handover-field/handover-field.module"
import { inventoryStockOutService } from "../inventory-stock-out/inventory-stock-out.module"

const handoverRepository = new TypeOrmHandoverRepository()
export const handoverService = new HandoverService(
    handoverRepository,
    assetService,
    employeeService,
    assetHolderService,
    assetLogService,
    attachmentService,
    handoverFieldService,
    inventoryStockOutService
)
export const handoverController = new HandoverController(handoverService)
