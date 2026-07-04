import { AiService } from "./ai.service"
import { AiController } from "./ai.controller"

const aiService = new AiService()
export const aiController = new AiController(aiService)
