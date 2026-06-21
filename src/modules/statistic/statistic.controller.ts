import { Context } from "hono"
import { StatisticService } from "./statistic.service"
import { ApiResponse } from "../../core/helpers/response"

export class StatisticController {
    constructor(private readonly service: StatisticService) {}

    async summary(c: Context) {
        const data = await this.service.getSummary()
        return ApiResponse.success(c, data, "Statistics retrieved successfully")
    }
}
