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
        module: string
        action: string
        description: string
        createdByUserId?: number | null
        oldValue?: Record<string, any> | null
        newValue?: Record<string, any> | null
    }, manager?: EntityManager): Promise<AssetLog> {
        return await this.repository.save({
            assetId: data.assetId,
            module: data.module,
            action: data.action,
            description: data.description,
            createdByUserId: data.createdByUserId,
            oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
            newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        }, manager)
    }
}
