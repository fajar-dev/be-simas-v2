import { EntityManager } from "typeorm"
import { Asset } from "../entities/asset.entity"

export interface IAssetRepository {
    findAll(page: number, limit: number, q: string): Promise<{ data: Asset[]; total: number }>
    findById(id: number): Promise<Asset | null>
    save(data: Partial<Asset>, manager?: EntityManager): Promise<Asset>
    merge(entity: Asset, data: Partial<Asset>): Asset
    delete(id: number): Promise<void>
}
