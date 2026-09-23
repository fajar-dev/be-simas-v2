import {
    AssetGroupStat,
    DepreciationReport,
    IStatisticRepository,
    LabeledCount,
    StatisticSummary,
} from "./interfaces/statistic.repository.interface"

export class StatisticService {
    constructor(private readonly repository: IStatisticRepository) {}

    async getSummary(statuses?: string[]): Promise<StatisticSummary> {
        return await this.repository.getSummary(statuses)
    }

    async getAssetsByCategory(statuses?: string[]): Promise<AssetGroupStat[]> {
        return await this.repository.getAssetsByCategory(statuses)
    }

    async getAssetsByLocation(statuses?: string[]): Promise<AssetGroupStat[]> {
        return await this.repository.getAssetsByLocation(statuses)
    }

    async getAssetsBySubCategory(statuses?: string[]): Promise<AssetGroupStat[]> {
        return await this.repository.getAssetsBySubCategory(statuses)
    }

    async getAssetAging(statuses?: string[]): Promise<LabeledCount[]> {
        return await this.repository.getAssetAging(statuses)
    }

    async getDataQuality(statuses?: string[]): Promise<LabeledCount[]> {
        return await this.repository.getDataQuality(statuses)
    }

    async getDepreciation(): Promise<DepreciationReport> {
        return await this.repository.getDepreciation()
    }
}
