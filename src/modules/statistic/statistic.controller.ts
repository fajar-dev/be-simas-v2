import { Context } from "hono"
import { StatisticService } from "./statistic.service"
import { ApiResponse } from "../../core/helpers/response"

export class StatisticController {
    constructor(private readonly service: StatisticService) {}

    private getStatuses(c: Context): string[] | undefined {
        const raw = c.req.query("status")
        if (!raw) return undefined
        return raw.split(",").map(s => s.trim()).filter(Boolean)
    }

    async summary(c: Context) {
        const data = await this.service.getSummary(this.getStatuses(c))
        return ApiResponse.success(c, data, "Statistics retrieved successfully")
    }

    async assetsByCategory(c: Context) {
        const data = await this.service.getAssetsByCategory(this.getStatuses(c))
        return ApiResponse.success(c, data, "Assets by category retrieved successfully")
    }

    async assetsByLocation(c: Context) {
        const data = await this.service.getAssetsByLocation(this.getStatuses(c))
        return ApiResponse.success(c, data, "Assets by location retrieved successfully")
    }

    async assetsBySubCategory(c: Context) {
        const data = await this.service.getAssetsBySubCategory(this.getStatuses(c))
        return ApiResponse.success(c, data, "Assets by sub category retrieved successfully")
    }

    async assetAging(c: Context) {
        const data = await this.service.getAssetAging(this.getStatuses(c))
        return ApiResponse.success(c, data, "Asset aging retrieved successfully")
    }

    async dataQuality(c: Context) {
        const data = await this.service.getDataQuality(this.getStatuses(c))
        return ApiResponse.success(c, data, "Data quality retrieved successfully")
    }

    async depreciation(c: Context) {
        const data = await this.service.getDepreciation()
        return ApiResponse.success(c, data, "Depreciation statistics retrieved successfully")
    }
}
