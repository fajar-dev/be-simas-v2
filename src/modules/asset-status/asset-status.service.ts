import { AssetStatus } from "./entities/asset-status.entity"
import { IAssetStatusRepository } from "./interfaces/asset-status.repository.interface"
import { assetLogService } from "../asset-log/asset-log.module"
import { EntityManager } from "typeorm"
import { AppDataSource } from "../../config/database"
import { Asset } from "../asset/entities/asset.entity"
import { NotFoundException } from "../../core/exceptions/base"
import { AssetHolderService } from "../asset-holder/asset-holder.service"

export class AssetStatusService {
    constructor(
        private readonly repository: IAssetStatusRepository,
        private readonly assetHolderService: AssetHolderService
    ) {}

    async getByAssetId(assetId: number, page: number, limit: number): Promise<{ data: AssetStatus[]; total: number }> {
        return await this.repository.findByAssetId(assetId, page, limit)
    }

    async findLastStatus(assetId: number): Promise<AssetStatus | null> {
        return await this.repository.findLastByAssetId(assetId)
    }

    async create(data: { assetId: number; status: string; note?: string | null; createdByUserId?: number | null; returnActiveHolders?: boolean }): Promise<AssetStatus> {
        // Validate asset exists
        const assetExists = await AppDataSource.getRepository(Asset).findOneBy({ id: data.assetId })
        if (!assetExists) {
            throw new NotFoundException("Asset not found")
        }

        const record = await this.repository.save({
            assetId: data.assetId,
            status: data.status,
            note: data.note || null,
            createdByUserId: data.createdByUserId,
        })

        // Auto-return active holder if requested
        if (data.returnActiveHolders) {
            await this.returnActiveHolderForAsset(data.assetId, data.createdByUserId)
        }

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

    async bulkCreate(data: { assetIds: number[]; status: string; note?: string | null; createdByUserId?: number | null; returnActiveHolders?: boolean }): Promise<{ count: number }> {
        let count = 0
        for (const assetId of data.assetIds) {
            await this.create({
                assetId,
                status: data.status,
                note: data.note,
                createdByUserId: data.createdByUserId,
                returnActiveHolders: data.returnActiveHolders,
            })
            count++
        }
        return { count }
    }

    async save(data: Partial<AssetStatus>, manager?: EntityManager): Promise<AssetStatus> {
        return await this.repository.save(data, manager)
    }

    /**
     * Return the active holder for a specific asset (if any).
     */
    private async returnActiveHolderForAsset(assetId: number, userId?: number | null): Promise<void> {
        const activeHolder = await this.assetHolderService.findActiveHolder(assetId)
        if (activeHolder) {
            await this.assetHolderService.returnAsset(activeHolder.id, {
                returnedDate: new Date().toISOString().split("T")[0],
                returnNote: "Auto-returned due to status change",
                returnedByUserId: userId || undefined,
            })
        }
    }
}
