import { AssetStatus } from "./entities/asset-status.entity"
import { IAssetStatusRepository } from "./interfaces/asset-status.repository.interface"
import { assetLogService } from "../asset-log/asset-log.module"
import { EntityManager } from "typeorm"

export class AssetStatusService {
    constructor(private readonly repository: IAssetStatusRepository) {}

    private get assetService() { return require("../asset/asset.module").assetService }

    async getByAssetId(assetId: number, page: number, limit: number): Promise<{ data: AssetStatus[]; total: number }> {
        return await this.repository.findByAssetId(assetId, page, limit)
    }

    async findLastStatus(assetId: number): Promise<AssetStatus | null> {
        return await this.repository.findLastByAssetId(assetId)
    }

    async create(data: { assetId: number; status: string; note?: string | null; createdByUserId?: number | null }): Promise<AssetStatus> {
        // Validate asset exists
        await this.assetService.getById(data.assetId)

        const record = await this.repository.save({
            assetId: data.assetId,
            status: data.status,
            note: data.note || null,
            date: new Date().toISOString().split('T')[0],
            createdByUserId: data.createdByUserId,
        })

        // Log status change
        await assetLogService.log({
            assetId: data.assetId,
            module: "status",
            action: "update",
            description: `Asset status changed to "${data.status}".`,
            createdByUserId: data.createdByUserId,
        })

        return record
    }

    async save(data: Partial<AssetStatus>, manager?: EntityManager): Promise<AssetStatus> {
        return await this.repository.save(data, manager)
    }
}
