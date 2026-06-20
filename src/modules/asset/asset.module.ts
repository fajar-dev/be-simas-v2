import { AssetRepository } from "./repositories/asset.repository"
import { AssetService } from "./asset.service"
import { AssetController } from "./asset.controller"

const assetRepository = new AssetRepository()
export const assetService = new AssetService(assetRepository)

export const assetController = new AssetController(assetService)
