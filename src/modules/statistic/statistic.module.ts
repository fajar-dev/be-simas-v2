import { StatisticService } from "./statistic.service"
import { StatisticController } from "./statistic.controller"

const statisticService = new StatisticService()
export const statisticController = new StatisticController(statisticService)
