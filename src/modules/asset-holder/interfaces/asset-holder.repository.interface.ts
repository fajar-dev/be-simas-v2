import { EntityManager } from "typeorm"
import { AssetHolder } from "../entities/asset-holder.entity"

export interface IAssetHolderRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number,
        employeeId?: number
    ): Promise<{ data: AssetHolder[]; total: number }>
    findById(id: number): Promise<AssetHolder | null>
    findActiveByAssetId(assetId: number): Promise<AssetHolder | null>
    findActiveByHandoverId(handoverId: number): Promise<AssetHolder[]>
    save(data: Partial<AssetHolder>, manager?: EntityManager): Promise<AssetHolder>
}
