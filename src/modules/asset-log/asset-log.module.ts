import { AssetLogRepository } from "./repositories/asset-log.repository"
import { AssetLogService } from "./asset-log.service"
import { AssetLogController } from "./asset-log.controller"

const assetLogRepository = new AssetLogRepository()
export const assetLogService = new AssetLogService(assetLogRepository)
export const assetLogController = new AssetLogController(assetLogService)
