import { TypeOrmAssetHolderRepository } from "./repositories/typeorm-asset-holder.repository"
import { AssetHolderService } from "./asset-holder.service"
import { AssetHolderController } from "./asset-holder.controller"
import { attachmentService } from "../attachment/attachment.module"

const assetHolderRepository = new TypeOrmAssetHolderRepository()
export const assetHolderService = new AssetHolderService(assetHolderRepository, attachmentService)
export const assetHolderController = new AssetHolderController(assetHolderService)
