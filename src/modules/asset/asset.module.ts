import { AssetRepository } from "./repositories/asset.repository"
import { AssetService } from "./asset.service"
import { AssetExportService } from "./asset-export.service"
import { AssetController } from "./asset.controller"

const assetRepository = new AssetRepository()
export const assetService = new AssetService(assetRepository)
const assetExportService = new AssetExportService()

export const assetController = new AssetController(assetService, assetExportService)
