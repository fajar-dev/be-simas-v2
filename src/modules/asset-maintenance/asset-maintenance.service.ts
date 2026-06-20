import { AssetMaintenance } from "./entities/asset-maintenance.entity"
import { IAssetMaintenanceRepository } from "./interfaces/asset-maintenance.repository.interface"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { Asset } from "../asset/entities/asset.entity"
import { AppDataSource } from "../../config/database"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { assetLogService } from "../asset-log/asset-log.module"

export class AssetMaintenanceService {
    constructor(
        private readonly repository: IAssetMaintenanceRepository,
        private readonly attachmentService: AttachmentService
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
        // Validate asset exists
        const assetRepo = AppDataSource.getRepository(Asset)
        const assetExists = await assetRepo.findOneBy({ id: data.assetId })
        if (!assetExists) {
            throw new NotFoundException("Asset not found")
        }

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            const maintenance = await this.repository.save({
                assetId: data.assetId,
                date: data.date,
                note: data.note,
                createdByUserId: data.createdByUserId,
            }, queryRunner.manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetMaintenance", maintenance.id, queryRunner.manager)
            }

            // Log Asset maintenance creation
            await assetLogService.log({
                assetId: data.assetId!,
                action: "maintenance_create",
                description: `Maintenance recorded: ${data.note || "No notes"}.`,
                createdByUserId: data.createdByUserId,
                newValue: data,
            }, queryRunner.manager)

            await queryRunner.commitTransaction()
            
            // Reload with relations
            const reloaded = await this.repository.findById(maintenance.id)
            if (!reloaded) throw new NotFoundException("Created record could not be loaded")
            return reloaded
        } catch (err) {
            await queryRunner.rollbackTransaction()
            throw err
        } finally {
            await queryRunner.release()
        }
    }

    async update(id: number, data: Partial<AssetMaintenance> & { attachmentIds?: number[] }, operatorId?: number): Promise<AssetMaintenance> {
        const { maintenance } = await this.getById(id)

        if (data.assetId && data.assetId !== maintenance.assetId) {
            const assetRepo = AppDataSource.getRepository(Asset)
            const assetExists = await assetRepo.findOneBy({ id: data.assetId })
            if (!assetExists) {
                throw new NotFoundException("Asset not found")
            }
        }

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            this.repository.merge(maintenance, {
                assetId: data.assetId,
                date: data.date,
                note: data.note,
            })
            
            const updated = await this.repository.save(maintenance, queryRunner.manager)

            if (data.attachmentIds !== undefined) {
                // Delete orphaned attachments (those not in the list anymore)
                await this.attachmentService.disassociateOrphans("AssetMaintenance", id, data.attachmentIds, queryRunner.manager)
                // Associate new attachments
                await this.attachmentService.associate(data.attachmentIds, "AssetMaintenance", id, queryRunner.manager)
            }

            // Log Asset maintenance update
            await assetLogService.log({
                assetId: maintenance.assetId,
                action: "maintenance_update",
                description: `Maintenance record updated: ${data.note || maintenance.note || "No notes"}.`,
                createdByUserId: operatorId,
                oldValue: { ...maintenance },
                newValue: data,
            }, queryRunner.manager)

            await queryRunner.commitTransaction()

            // Reload with relations
            const reloaded = await this.repository.findById(id)
            if (!reloaded) throw new NotFoundException("Updated record could not be loaded")
            return reloaded
        } catch (err) {
            await queryRunner.rollbackTransaction()
            throw err
        } finally {
            await queryRunner.release()
        }
    }

    async delete(id: number, operatorId?: number): Promise<void> {
        const { maintenance } = await this.getById(id)

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            // Delete all associated files & db entries
            await this.attachmentService.disassociateOrphans("AssetMaintenance", id, [], queryRunner.manager)
            // Delete record
            await this.repository.delete(id, queryRunner.manager)

            // Log Asset maintenance deletion
            await assetLogService.log({
                assetId: maintenance.assetId,
                action: "maintenance_delete",
                description: `Maintenance record was deleted (Note: "${maintenance.note || 'No notes'}").`,
                createdByUserId: operatorId,
                oldValue: { ...maintenance },
            }, queryRunner.manager)

            await queryRunner.commitTransaction()
        } catch (err) {
            await queryRunner.rollbackTransaction()
            throw err
        } finally {
            await queryRunner.release()
        }
    }
}
