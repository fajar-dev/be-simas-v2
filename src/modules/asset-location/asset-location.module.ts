import { TypeOrmAssetLocationRepository } from "./repositories/typeorm-asset-location.repository"
import { AssetLocationService } from "./asset-location.service"
import { AssetLocationController } from "./asset-location.controller"

const assetLocationRepository = new TypeOrmAssetLocationRepository()
export const assetLocationService = new AssetLocationService(assetLocationRepository)
export const assetLocationController = new AssetLocationController(assetLocationService)
