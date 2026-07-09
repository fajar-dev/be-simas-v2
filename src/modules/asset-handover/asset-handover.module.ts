import { TypeOrmAssetHandoverRepository } from "./repositories/typeorm-asset-handover.repository"
import { AssetHandoverService } from "./asset-handover.service"
import { AssetHandoverController } from "./asset-handover.controller"
import { assetService } from "../asset/asset.module"
import { employeeService } from "../employee/employee.module"
import { assetHolderService } from "../asset-holder/asset-holder.module"
import { assetLogService } from "../asset-log/asset-log.module"
import { attachmentService } from "../attachment/attachment.module"

const assetHandoverRepository = new TypeOrmAssetHandoverRepository()
export const assetHandoverService = new AssetHandoverService(
    assetHandoverRepository,
    assetService,
    employeeService,
    assetHolderService,
    assetLogService,
    attachmentService
)
export const assetHandoverController = new AssetHandoverController(assetHandoverService)
