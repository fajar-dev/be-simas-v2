import { AssetLocationRepository } from "./repositories/asset-location.repository"
import { AssetLocationService } from "./asset-location.service"
import { AssetLocationController } from "./asset-location.controller"
import { attachmentService } from "../attachment/attachment.module"
import { assetService } from "../asset/asset.module"
import { locationService } from "../location/location.module"

const assetLocationRepository = new AssetLocationRepository()
export const assetLocationService = new AssetLocationService(assetLocationRepository, attachmentService, assetService, locationService)
export const assetLocationController = new AssetLocationController(assetLocationService)
