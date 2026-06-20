import { IAssetLogRepository } from "./interfaces/asset-log.repository.interface"
import { AssetLog } from "./entities/asset-log.entity"
import { EntityManager } from "typeorm"

export class AssetLogService {
    constructor(private readonly repository: IAssetLogRepository) {}

    async getAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetLog[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order, assetId)
    }

    async log(data: {
        assetId: number
        action: string
        description: string
        createdByUserId?: number | null
    }, manager?: EntityManager): Promise<AssetLog> {
        return await this.repository.save(data, manager)
    }
}
