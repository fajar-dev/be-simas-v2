import { TypeOrmHandoverFieldRepository } from "./repositories/typeorm-handover-field.repository"
import { HandoverFieldService } from "./handover-field.service"
import { HandoverFieldController } from "./handover-field.controller"

const handoverFieldRepository = new TypeOrmHandoverFieldRepository()
export const handoverFieldService = new HandoverFieldService(handoverFieldRepository)
export const handoverFieldController = new HandoverFieldController(handoverFieldService)
