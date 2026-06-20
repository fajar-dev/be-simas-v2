import { AttachmentRepository } from "./repositories/attachment.repository"
import { AttachmentService } from "./attachment.service"
import { AttachmentController } from "./attachment.controller"

const attachmentRepository = new AttachmentRepository()
export const attachmentService = new AttachmentService(attachmentRepository)
export const attachmentController = new AttachmentController(attachmentService)
