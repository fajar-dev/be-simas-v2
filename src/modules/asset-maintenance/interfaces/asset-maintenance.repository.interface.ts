import { AssetMaintenance } from "../entities/asset-maintenance.entity"
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
}
