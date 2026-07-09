import { AssetStatusRepository } from "./repositories/asset-status.repository"
import { AssetStatusService } from "./asset-status.service"
import { AssetStatusController } from "./asset-status.controller"
import { assetHolderService } from "../asset-holder/asset-holder.module"

const assetStatusRepository = new AssetStatusRepository()
export const assetStatusService = new AssetStatusService(assetStatusRepository, assetHolderService)
export const assetStatusController = new AssetStatusController(assetStatusService)
