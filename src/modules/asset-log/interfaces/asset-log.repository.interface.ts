import { AssetLog } from "../entities/asset-log.entity"
import { EntityManager } from "typeorm"

export interface IAssetLogRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetLog[]; total: number }>
    findById(id: number): Promise<AssetLog | null>
    save(data: Partial<AssetLog>, manager?: EntityManager): Promise<AssetLog>
}
