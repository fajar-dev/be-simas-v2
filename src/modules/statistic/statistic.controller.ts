import { Context } from "hono"
import { StatisticService } from "./statistic.service"
import { ApiResponse } from "../../core/helpers/response"

export class StatisticController {
    constructor(private readonly service: StatisticService) {}

    async summary(c: Context) {
        const data = await this.service.getSummary()
        return ApiResponse.success(c, data, "Statistics retrieved successfully")
    }

    async assetsByCategory(c: Context) {
        const data = await this.service.getAssetsByCategory()
        return ApiResponse.success(c, data, "Assets by category retrieved successfully")
    }

    async assetsByLocation(c: Context) {
        const data = await this.service.getAssetsByLocation()
        return ApiResponse.success(c, data, "Assets by location retrieved successfully")
    }

    async assetsBySubCategory(c: Context) {
        const data = await this.service.getAssetsBySubCategory()
        return ApiResponse.success(c, data, "Assets by sub category retrieved successfully")
    }

    async assetAging(c: Context) {
        const data = await this.service.getAssetAging()
        return ApiResponse.success(c, data, "Asset aging retrieved successfully")
    }

    async dataQuality(c: Context) {
        const data = await this.service.getDataQuality()
        return ApiResponse.success(c, data, "Data quality retrieved successfully")
    }
}
