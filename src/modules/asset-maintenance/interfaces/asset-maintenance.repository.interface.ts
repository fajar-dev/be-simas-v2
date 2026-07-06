import { AssetMaintenance } from "../entities/asset-maintenance.entity"
import { AssetLabel } from "../../asset/entities/asset-label.entity"
import { EntityManager } from "typeorm"

export interface IAssetMaintenanceRepository {
    findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetMaintenance[]; total: number }>
    findById(id: number): Promise<AssetMaintenance | null>
    save(data: Partial<AssetMaintenance>, manager?: EntityManager): Promise<AssetMaintenance>
    merge(entity: AssetMaintenance, data: Partial<AssetMaintenance>): AssetMaintenance
    delete(id: number, manager?: EntityManager): Promise<void>
    deleteLabels(entityType: string, entityId: number, manager?: EntityManager): Promise<void>
    saveLabels(entityType: string, entityId: number, labels: { key: string; value: string }[], manager?: EntityManager): Promise<void>
    getLabelsForEntity(entityType: string, entityId: number): Promise<AssetLabel[]>
    getLabelsForEntities(entityType: string, entityIds: number[]): Promise<Map<number, AssetLabel[]>>
    getUniqueLabelKeys(entityType: string, assetId?: number): Promise<string[]>
}
