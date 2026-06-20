import { AssetMaintenanceRepository } from "./repositories/asset-maintenance.repository"
import { AssetMaintenanceService } from "./asset-maintenance.service"
import { AssetMaintenanceController } from "./asset-maintenance.controller"
import { attachmentService } from "../attachment/attachment.module"

const assetMaintenanceRepository = new AssetMaintenanceRepository()
const assetMaintenanceService = new AssetMaintenanceService(assetMaintenanceRepository, attachmentService)

export const assetMaintenanceController = new AssetMaintenanceController(assetMaintenanceService)
