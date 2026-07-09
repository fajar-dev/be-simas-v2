import { EntityManager } from "typeorm"
import { AssetHandover } from "../entities/asset-handover.entity"
import { AssetHandoverItem } from "../entities/asset-handover-item.entity"

export interface AssetHandoverFilter {
    status?: string
    transactionType?: string
}

export interface IAssetHandoverRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        filters?: AssetHandoverFilter
    ): Promise<{ data: AssetHandover[]; total: number }>
    findById(id: number): Promise<AssetHandover | null>
    findPendingItemAssetIds(excludeHandoverId?: number): Promise<number[]>
    save(data: Partial<AssetHandover>, manager?: EntityManager): Promise<AssetHandover>
    saveItem(data: Partial<AssetHandoverItem>, manager?: EntityManager): Promise<AssetHandoverItem>
    deleteItems(handoverId: number, manager?: EntityManager): Promise<void>
    delete(id: number, manager?: EntityManager): Promise<void>
    merge(entity: AssetHandover, data: Partial<AssetHandover>): AssetHandover
}
