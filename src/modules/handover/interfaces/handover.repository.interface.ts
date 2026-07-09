import { EntityManager } from "typeorm"
import { Handover } from "../entities/handover.entity"
import { HandoverItem } from "../entities/handover-item.entity"

export interface HandoverFilter {
    status?: string
    transactionType?: string
}

export interface IHandoverRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        filters?: HandoverFilter
    ): Promise<{ data: Handover[]; total: number }>
    findById(id: number): Promise<Handover | null>
    findPendingItemAssetIds(excludeHandoverId?: number): Promise<number[]>
    save(data: Partial<Handover>, manager?: EntityManager): Promise<Handover>
    saveItem(data: Partial<HandoverItem>, manager?: EntityManager): Promise<HandoverItem>
    deleteItems(handoverId: number, manager?: EntityManager): Promise<void>
    delete(id: number, manager?: EntityManager): Promise<void>
    merge(entity: Handover, data: Partial<Handover>): Handover
}
