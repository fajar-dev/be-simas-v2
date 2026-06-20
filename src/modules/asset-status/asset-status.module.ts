import { AssetStatusRepository } from "./repositories/asset-status.repository"
import { AssetStatusService } from "./asset-status.service"
import { AssetStatusController } from "./asset-status.controller"

const assetStatusRepository = new AssetStatusRepository()
export const assetStatusService = new AssetStatusService(assetStatusRepository)
export const assetStatusController = new AssetStatusController(assetStatusService)
