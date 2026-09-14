import { QueueRepository } from "./repositories/queue.repository"
import { QueueService } from "./queue.service"
import { QueueController } from "./queue.controller"

const queueRepository = new QueueRepository()
export const queueService = new QueueService(queueRepository)
export const queueController = new QueueController(queueService)
