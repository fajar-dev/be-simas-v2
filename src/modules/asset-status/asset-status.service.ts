import { AssetStatus } from "./entities/asset-status.entity"
import { IAssetStatusRepository } from "./interfaces/asset-status.repository.interface"
import { assetLogService } from "../asset-log/asset-log.module"
import { EntityManager } from "typeorm"
import { AppDataSource } from "../../config/database"
import { Asset } from "../asset/entities/asset.entity"
import { HandoverItem } from "../handover/entities/handover-item.entity"
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
        // Validate asset exists
        const assetExists = await AppDataSource.getRepository(Asset).findOneBy({ id: data.assetId })
        if (!assetExists) {
            throw new NotFoundException("Asset not found")
        }

        // Keep the handover lifecycle authoritative: an asset held via a handover
        // must first be returned through a return handover before its status can change.
        await this.assertNotTiedToHandover(data.assetId)

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
        // Reject the whole batch up front if any asset is held via a handover,
        // so no partial status changes are applied.
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

    /**
     * Reject a status change while the asset is tied to a handover, so the handover
     * lifecycle stays authoritative:
     * - held by an active holder that came from a handover → return it via a return handover first;
     * - part of a pending handover → complete or cancel that handover first.
     */
    private async assertNotTiedToHandover(assetId: number): Promise<void> {
        const activeHolder = await this.assetHolderService.findActiveHolder(assetId)
        if (activeHolder?.assignHandoverId) {
            const name = activeHolder.asset?.name || `#${assetId}`
            throw new BadRequestException(`Asset "${name}" is held via a handover; return it through a return handover before changing its status`)
        }
        if (await this.isInPendingHandover(assetId)) {
            const asset = await AppDataSource.getRepository(Asset).findOneBy({ id: assetId })
            const name = asset?.name || `#${assetId}`
            throw new BadRequestException(`Asset "${name}" is in a pending handover; complete or cancel it before changing its status`)
        }
    }

    /** Whether the asset is currently part of a pending (assign or return) handover. */
    private async isInPendingHandover(assetId: number): Promise<boolean> {
        const count = await AppDataSource.getRepository(HandoverItem)
            .createQueryBuilder("item")
            .innerJoin("item.handover", "handover")
            .where("item.assetId = :assetId", { assetId })
            .andWhere("handover.status = :status", { status: "pending" })
            .getCount()
        return count > 0
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
