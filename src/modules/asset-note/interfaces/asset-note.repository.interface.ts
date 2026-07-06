import { AssetNote } from "../entities/asset-note.entity"
import { AssetLabel } from "../../asset/entities/asset-label.entity"
import { EntityManager } from "typeorm"

export interface IAssetNoteRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetNote[]; total: number }>
    findById(id: number): Promise<AssetNote | null>
    save(data: Partial<AssetNote>, manager?: EntityManager): Promise<AssetNote>
    merge(entity: AssetNote, data: Partial<AssetNote>): AssetNote
    delete(id: number, manager?: EntityManager): Promise<void>
    deleteLabels(entityType: string, entityId: number, manager?: EntityManager): Promise<void>
    saveLabels(entityType: string, entityId: number, labels: { key: string; value: string }[], manager?: EntityManager): Promise<void>
    getLabelsForEntity(entityType: string, entityId: number): Promise<AssetLabel[]>
    getLabelsForEntities(entityType: string, entityIds: number[]): Promise<Map<number, AssetLabel[]>>
    getUniqueLabelKeys(entityType: string, assetId?: number): Promise<string[]>
}
