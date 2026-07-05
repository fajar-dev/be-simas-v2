import { AssetMaintenance } from "./entities/asset-maintenance.entity"
import { IAssetMaintenanceRepository } from "./interfaces/asset-maintenance.repository.interface"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { assetLogService } from "../asset-log/asset-log.module"
import type { AssetService } from "../asset/asset.service"
import { withTransaction } from "../../core/helpers/transaction"

export class AssetMaintenanceService {
    constructor(
        private readonly repository: IAssetMaintenanceRepository,
        private readonly attachmentService: AttachmentService,
        private readonly assetService: AssetService
    ) {}

    async getAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: { maintenance: AssetMaintenance; attachments: Attachment[] }[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, assetId)
        
        const mapped = await Promise.all(data.map(async (maintenance) => {
            const attachments = await this.attachmentService.getForEntity("AssetMaintenance", maintenance.id)
            return { maintenance, attachments }
        }))

        return { data: mapped, total }
    }

    async getById(id: number): Promise<{ maintenance: AssetMaintenance; attachments: Attachment[] }> {
        const maintenance = await this.repository.findById(id)
        if (!maintenance) {
            throw new NotFoundException("Asset maintenance record not found")
        }

        const attachments = await this.attachmentService.getForEntity("AssetMaintenance", id)
        return { maintenance, attachments }
    }

    async create(data: Partial<AssetMaintenance> & { attachmentIds?: number[] }): Promise<AssetMaintenance> {
        // Validate asset exists (throws NotFoundException if not found)
        await this.assetService.getById(data.assetId!)

        const maintenance = await withTransaction(async (manager) => {
            const maintenance = await this.repository.save({
                assetId: data.assetId,
                date: data.date,
                note: data.note,
                cost: data.cost,
                createdByUserId: data.createdByUserId,
            }, manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetMaintenance", maintenance.id, manager)
            }

            // Log Asset maintenance creation
            await assetLogService.log({
                assetId: data.assetId!,
                module: "maintenance",
                action: "create",
                description: `Maintenance recorded: ${data.note || "No notes"}.`,
                createdByUserId: data.createdByUserId,
                newValue: data,
            }, manager)

            return maintenance
        })

        // Reload with relations
        const reloaded = await this.repository.findById(maintenance.id)
        if (!reloaded) throw new NotFoundException("Created record could not be loaded")
        return reloaded
    }

    async update(id: number, data: Partial<AssetMaintenance> & { attachmentIds?: number[] }, operatorId?: number): Promise<AssetMaintenance> {
        const { maintenance } = await this.getById(id)

        if (data.assetId && data.assetId !== maintenance.assetId) {
            // Validate new asset exists (throws NotFoundException if not found)
            await this.assetService.getById(data.assetId)
        }

        await withTransaction(async (manager) => {
            this.repository.merge(maintenance, {
                assetId: data.assetId,
                date: data.date,
                note: data.note,
                cost: data.cost,
            })
            
            await this.repository.save(maintenance, manager)

            if (data.attachmentIds !== undefined) {
                // Delete orphaned attachments (those not in the list anymore)
                await this.attachmentService.disassociateOrphans("AssetMaintenance", id, data.attachmentIds, manager)
                // Associate new attachments
                await this.attachmentService.associate(data.attachmentIds, "AssetMaintenance", id, manager)
            }

            // Log Asset maintenance update
            await assetLogService.log({
                assetId: maintenance.assetId,
                module: "maintenance",
                action: "update",
                description: `Maintenance updated: ${data.note || maintenance.note || "No notes"}.`,
                createdByUserId: operatorId,
                oldValue: { ...maintenance },
                newValue: data,
            }, manager)
        })

        // Reload with relations
        const reloaded = await this.repository.findById(id)
        if (!reloaded) throw new NotFoundException("Updated record could not be loaded")
        return reloaded
    }

    async delete(id: number, operatorId?: number): Promise<void> {
        const { maintenance } = await this.getById(id)

        await withTransaction(async (manager) => {
            // Delete all associated files & db entries
            await this.attachmentService.disassociateOrphans("AssetMaintenance", id, [], manager)
            // Delete record
            await this.repository.delete(id, manager)

            // Log Asset maintenance deletion
            await assetLogService.log({
                assetId: maintenance.assetId,
                module: "maintenance",
                action: "delete",
                description: `Maintenance deleted: ${maintenance.note || "No notes"}.`,
                createdByUserId: operatorId,
                oldValue: { ...maintenance },
            }, manager)
        })
    }
}
