import { AssetHolderRepository } from "./repositories/asset-holder.repository"
import { AssetHolderService } from "./asset-holder.service"
import { AssetHolderController } from "./asset-holder.controller"
import { attachmentService } from "../attachment/attachment.module"
import { employeeService } from "../employee/employee.module"

const assetHolderRepository = new AssetHolderRepository()
export const assetHolderService = new AssetHolderService(assetHolderRepository, attachmentService, employeeService)
export const assetHolderController = new AssetHolderController(assetHolderService)
