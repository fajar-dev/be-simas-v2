import { TypeOrmAssetRepository } from "./repositories/typeorm-asset.repository"
import { AssetService } from "./asset.service"
import { AssetController } from "./asset.controller"

const assetRepository = new TypeOrmAssetRepository()
const assetService = new AssetService(assetRepository)

export const assetController = new AssetController(assetService)
