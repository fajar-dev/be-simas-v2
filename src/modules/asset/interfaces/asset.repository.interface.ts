import { EntityManager } from "typeorm"
import { Asset } from "../entities/asset.entity"

export interface AssetFilter {
    categoryIds?: number[]
    subCategoryIds?: number[]
    branchIds?: number[]
    locationIds?: number[]
    status?: string[]
    holderStatus?: 'has_holder' | 'no_holder'
    bleTagStatus?: 'has_ble_tag' | 'no_ble_tag'
    holderId?: number
    priceMin?: number
    priceMax?: number
    purchaseDateFrom?: string
    purchaseDateTo?: string
    labels?: { key: string; value: string }[]
    missingFields?: string[]
    depreciationStatus?: 'has_depreciation' | 'no_depreciation' | 'fully_depreciated'
    usefulLifeOp?: '<' | '>' | '='
    usefulLifeYears?: number
    monthlyDepMin?: number
    monthlyDepMax?: number
    accumulatedDepMin?: number
    accumulatedDepMax?: number
    bookValueMin?: number
    bookValueMax?: number
}

export interface IAssetRepository {
    findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: AssetFilter): Promise<{ data: Asset[]; total: number }>
    findAllWithoutPagination(q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: AssetFilter): Promise<Asset[]>
    findById(id: number): Promise<Asset | null>
    findByCode(code: string): Promise<Asset | null>
    findByBleTagMac(mac: string): Promise<Asset | null>
    save(data: Partial<Asset>, manager?: EntityManager): Promise<Asset>
    merge(entity: Asset, data: Partial<Asset>): Asset
    delete(id: number): Promise<void>
    deleteLabels(assetId: number, manager?: EntityManager): Promise<void>
    saveLabels(assetId: number, labels: { key: string; value: string }[], manager?: EntityManager): Promise<void>
    getUniqueLabelKeys(): Promise<string[]>
}
