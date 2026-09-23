export interface AssetGroupStat {
    id: number
    name: string
    count: number
    totalPrice: number
    totalBookValue?: number
}

export interface StatisticSummary {
    totalAssets: number
    totalPrice: number
    totalBookValue: number
    totalDepreciation: number
    totalCategories: number
    totalSubCategories: number
    totalLocations: number
    totalBranches: number
    totalActiveEmployees: number
}

export interface LabeledCount {
    label: string
    count: number
}

export interface DepreciationReport {
    summary: {
        totalWithDepreciation: number
        totalMonthlyDepreciation: number
        totalAccumulatedDepreciation: number
        totalBookValue: number
    }
    statusBreakdown: LabeledCount[]
    byCategory: { name: string; originalPrice: number; bookValue: number }[]
}

export interface IStatisticRepository {
    getSummary(statuses?: string[]): Promise<StatisticSummary>
    getAssetsByCategory(statuses?: string[]): Promise<AssetGroupStat[]>
    getAssetsByLocation(statuses?: string[]): Promise<AssetGroupStat[]>
    getAssetsBySubCategory(statuses?: string[]): Promise<AssetGroupStat[]>
    getAssetAging(statuses?: string[]): Promise<LabeledCount[]>
    getDataQuality(statuses?: string[]): Promise<LabeledCount[]>
    getDepreciation(): Promise<DepreciationReport>
}
