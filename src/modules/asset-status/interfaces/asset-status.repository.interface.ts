import { EntityManager } from "typeorm"
import { AssetStatus } from "../entities/asset-status.entity"
import { Asset } from "../../asset/entities/asset.entity"

export interface IAssetStatusRepository {
    findByAssetId(assetId: number, page: number, limit: number): Promise<{ data: AssetStatus[]; total: number }>
    findLastByAssetId(assetId: number): Promise<AssetStatus | null>
    save(data: Partial<AssetStatus>, manager?: EntityManager): Promise<AssetStatus>
    findAsset(assetId: number): Promise<Pick<Asset, 'id' | 'name'> | null>
    countPendingHandoverItems(assetId: number): Promise<number>
}
