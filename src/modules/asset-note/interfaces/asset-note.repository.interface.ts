import { AssetNote } from "../entities/asset-note.entity"
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
}
