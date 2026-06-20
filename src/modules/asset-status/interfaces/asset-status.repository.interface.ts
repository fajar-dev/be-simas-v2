import { EntityManager } from "typeorm"
import { AssetStatus } from "../entities/asset-status.entity"

export interface IAssetStatusRepository {
    findByAssetId(assetId: number, page: number, limit: number): Promise<{ data: AssetStatus[]; total: number }>
    findLastByAssetId(assetId: number): Promise<AssetStatus | null>
    save(data: Partial<AssetStatus>, manager?: EntityManager): Promise<AssetStatus>
}
