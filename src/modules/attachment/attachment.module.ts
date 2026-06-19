import { TypeOrmAttachmentRepository } from "./repositories/typeorm-attachment.repository"
import { AttachmentService } from "./attachment.service"
import { AttachmentController } from "./attachment.controller"

const attachmentRepository = new TypeOrmAttachmentRepository()
export const attachmentService = new AttachmentService(attachmentRepository)
export const attachmentController = new AttachmentController(attachmentService)
