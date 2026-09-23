import { StatisticService } from "./statistic.service"
import { StatisticController } from "./statistic.controller"
import { StatisticRepository } from "./repositories/statistic.repository"

const statisticRepository = new StatisticRepository()
const statisticService = new StatisticService(statisticRepository)
export const statisticController = new StatisticController(statisticService)
