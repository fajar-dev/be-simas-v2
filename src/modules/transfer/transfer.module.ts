import { TypeOrmTransferRepository } from "./repositories/typeorm-transfer.repository"
import { TransferService } from "./transfer.service"
import { TransferController } from "./transfer.controller"
import { assetService } from "../asset/asset.module"

const transferRepository = new TypeOrmTransferRepository()
export const transferService = new TransferService(transferRepository, assetService)
export const transferController = new TransferController(transferService)
