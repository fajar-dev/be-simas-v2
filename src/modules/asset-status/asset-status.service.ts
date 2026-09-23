import { AssetStatus } from "./entities/asset-status.entity"
import { IAssetStatusRepository } from "./interfaces/asset-status.repository.interface"
import { assetLogService } from "../asset-log/asset-log.module"
import { EntityManager } from "typeorm"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
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
        const assetExists = await this.repository.findAsset(data.assetId)
        if (!assetExists) {
            throw new NotFoundException("Asset not found")
        }

        await this.assertNotTiedToHandover(data.assetId)

        const record = await this.repository.save({
            assetId: data.assetId,
            status: data.status,
            note: data.note || null,
            createdByUserId: data.createdByUserId,
        })

        if (data.returnActiveHolders) {
            await this.returnActiveHolderForAsset(data.assetId, data.createdByUserId)
        }

        await assetLogService.log({
            assetId: data.assetId,
            module: "status",
            action: "update",
            description: `Asset status changed to "${data.status}".`,
            createdByUserId: data.createdByUserId,
        })

        return record
    }

    /** Rejects the whole batch up front if any asset is tied to a handover, so no partial status changes are applied. */
    async bulkCreate(data: { assetIds: number[]; status: string; note?: string | null; createdByUserId?: number | null; returnActiveHolders?: boolean }): Promise<{ count: number }> {
        for (const assetId of data.assetIds) {
            await this.assertNotTiedToHandover(assetId)
        }

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

    /** Rejects a status change while the asset is held or pending via a handover, keeping the handover lifecycle authoritative. */
    private async assertNotTiedToHandover(assetId: number): Promise<void> {
        const activeHolder = await this.assetHolderService.findActiveHolder(assetId)
        if (activeHolder?.assignHandoverId) {
            const name = activeHolder.asset?.name || `#${assetId}`
            throw new BadRequestException(`Asset "${name}" is held via a handover; return it through a return handover before changing its status`)
        }
        if (await this.isInPendingHandover(assetId)) {
            const asset = await this.repository.findAsset(assetId)
            const name = asset?.name || `#${assetId}`
            throw new BadRequestException(`Asset "${name}" is in a pending handover; complete or cancel it before changing its status`)
        }
    }

    private async isInPendingHandover(assetId: number): Promise<boolean> {
        const count = await this.repository.countPendingHandoverItems(assetId)
        return count > 0
    }

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
