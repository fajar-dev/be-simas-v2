import { AssetLocation } from "./entities/asset-location.entity"
import { IAssetLocationRepository } from "./interfaces/asset-location.repository.interface"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { assetLogService } from "../asset-log/asset-log.module"
import type { AssetService } from "../asset/asset.service"
import type { LocationService } from "../location/location.service"
import { withTransaction } from "../../core/helpers/transaction"
import { EntityManager } from "typeorm"

export class AssetLocationService {
    constructor(
        private readonly repository: IAssetLocationRepository,
        private readonly attachmentService: AttachmentService,
        private readonly assetService: AssetService,
        private readonly locationService: LocationService
    ) {}

    async getAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: { log: AssetLocation; attachments: Attachment[] }[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, assetId)

        const mapped = await Promise.all(data.map(async (log) => {
            const attachments = await this.attachmentService.getForEntity("AssetLocation", log.id)
            return { log, attachments }
        }))

        return { data: mapped, total }
    }

    async getById(id: number): Promise<{ log: AssetLocation; attachments: Attachment[] }> {
        const log = await this.repository.findById(id)
        if (!log) {
            throw new NotFoundException("Asset location record not found")
        }
        const attachments = await this.attachmentService.getForEntity("AssetLocation", id)
        return { log, attachments }
    }

    async findLastLocation(assetId: number): Promise<AssetLocation | null> {
        return await this.repository.findLastLocation(assetId)
    }

    async create(data: Partial<AssetLocation> & { attachmentIds?: number[] }): Promise<AssetLocation> {
        // Validate asset exists (throws NotFoundException if not found)
        await this.assetService.getById(data.assetId!)

        // Validate location exists (throws NotFoundException if not found)
        const location = await this.locationService.getById(data.locationId!)

        // Prevent relocating to the same current location
        const currentLocation = await this.repository.findLatestByAssetId(data.assetId!)
        if (currentLocation && currentLocation.locationId === data.locationId) {
            throw new BadRequestException("Asset is already at this location")
        }

        const log = await withTransaction(async (manager) => {
            const log = await this.repository.save({
                assetId: data.assetId,
                locationId: data.locationId,
                date: data.date,
                note: data.note,
                createdByUserId: data.createdByUserId,
            }, manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetLocation", log.id, manager)
            }

            // Log Asset relocation
            await assetLogService.log({
                assetId: data.assetId!,
                module: "location",
                action: "relocate",
                description: `Asset relocated to "${location.name}".`,
                createdByUserId: data.createdByUserId,
                newValue: data,
            }, manager)

            return log
        })

        // Reload with relations
        const reloaded = await this.repository.findById(log.id)
        if (!reloaded) throw new NotFoundException("Created record could not be loaded")
        return reloaded
    }

    async save(data: Partial<AssetLocation>, manager?: EntityManager): Promise<AssetLocation> {
        return await this.repository.save(data, manager)
    }
}
