import { AssetNoteRepository } from "./repositories/asset-note.repository"
import { AssetNoteService } from "./asset-note.service"
import { AssetNoteController } from "./asset-note.controller"
import { attachmentService } from "../attachment/attachment.module"
import { assetService } from "../asset/asset.module"

const assetNoteRepository = new AssetNoteRepository()
const assetNoteService = new AssetNoteService(assetNoteRepository, attachmentService, assetService)

export const assetNoteController = new AssetNoteController(assetNoteService)
