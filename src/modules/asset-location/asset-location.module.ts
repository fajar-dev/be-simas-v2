import { TypeOrmAssetLocationRepository } from "./repositories/typeorm-asset-location.repository"
import { AssetLocationService } from "./asset-location.service"
import { AssetLocationController } from "./asset-location.controller"
import { attachmentService } from "../attachment/attachment.module"

const assetLocationRepository = new TypeOrmAssetLocationRepository()
export const assetLocationService = new AssetLocationService(assetLocationRepository, attachmentService)
export const assetLocationController = new AssetLocationController(assetLocationService)
