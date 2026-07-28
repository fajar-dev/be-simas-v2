import { TypeOrmAssetScheduleRepository } from "./repositories/typeorm-asset-schedule.repository"
import { AssetScheduleService } from "./asset-schedule.service"
import { AssetScheduleController } from "./asset-schedule.controller"
import { assetService } from "../asset/asset.module"
import { userService } from "../user/user.module"
import { attachmentService } from "../attachment/attachment.module"

const assetScheduleRepository = new TypeOrmAssetScheduleRepository()
export const assetScheduleService = new AssetScheduleService(
    assetScheduleRepository,
    assetService,
    userService,
    attachmentService
)
export const assetScheduleController = new AssetScheduleController(assetScheduleService)
