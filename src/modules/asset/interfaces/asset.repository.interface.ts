import { EntityManager } from "typeorm"
import { Asset } from "../entities/asset.entity"

export interface AssetFilter {
    categoryId?: number
    subCategoryId?: number
    branchId?: number
    locationId?: number
    holderStatus?: 'has_holder' | 'no_holder'
    holderId?: number
    priceMin?: number
    priceMax?: number
    purchaseDateFrom?: string
    purchaseDateTo?: string
}

export interface IAssetRepository {
    findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: AssetFilter): Promise<{ data: Asset[]; total: number }>
    findById(id: number): Promise<Asset | null>
    findByCode(code: string): Promise<Asset | null>
    save(data: Partial<Asset>, manager?: EntityManager): Promise<Asset>
    merge(entity: Asset, data: Partial<Asset>): Asset
    delete(id: number): Promise<void>
    deleteLabels(assetId: number): Promise<void>
    saveLabels(assetId: number, labels: { key: string; value: string }[]): Promise<void>
    getUniqueLabelKeys(): Promise<string[]>
}
