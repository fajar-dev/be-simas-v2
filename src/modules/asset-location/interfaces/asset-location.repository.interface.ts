import { AssetLocation } from "../entities/asset-location.entity"
import { EntityManager } from "typeorm"

export interface IAssetLocationRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetLocation[]; total: number }>
    findById(id: number): Promise<AssetLocation | null>
    save(data: Partial<AssetLocation>, manager?: EntityManager): Promise<AssetLocation>
}
