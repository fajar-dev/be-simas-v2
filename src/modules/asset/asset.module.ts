import { AssetRepository } from "./repositories/asset.repository"
import { AssetService } from "./asset.service"
import { AssetUtilService } from "./asset-util.service"
import { AssetController } from "./asset.controller"

const assetRepository = new AssetRepository()
export const assetService = new AssetService(assetRepository)
const assetUtilService = new AssetUtilService()

export const assetController = new AssetController(assetService, assetUtilService)
