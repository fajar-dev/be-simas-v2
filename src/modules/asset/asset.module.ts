import { AssetRepository } from "./repositories/asset.repository"
import { AssetService } from "./asset.service"
import { AssetUtilService } from "./asset-util.service"
import { AssetController } from "./asset.controller"
import { assetHolderService } from "../asset-holder/asset-holder.module"
import { assetLocationService } from "../asset-location/asset-location.module"
import { assetStatusService } from "../asset-status/asset-status.module"
import { employeeService } from "../employee/employee.module"
import { locationService } from "../location/location.module"

const assetRepository = new AssetRepository()
export const assetService = new AssetService(
    assetRepository,
    assetHolderService,
    assetLocationService,
    assetStatusService,
    employeeService,
    locationService
)
const assetUtilService = new AssetUtilService(assetService)

export const assetController = new AssetController(assetService, assetUtilService)
