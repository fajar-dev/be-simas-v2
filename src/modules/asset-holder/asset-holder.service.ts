import { AssetHolder } from "./entities/asset-holder.entity"
import { IAssetHolderRepository } from "./interfaces/asset-holder.repository.interface"
import { Asset } from "../asset/entities/asset.entity"
import { Employee } from "../employee/entities/employee.entity"
import { AppDataSource } from "../../config/database"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { assetLogService } from "../asset-log/asset-log.module"

export class AssetHolderService {
    constructor(
        private readonly repository: IAssetHolderRepository,
        private readonly attachmentService: AttachmentService
    ) {}

    async getAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number,
        employeeId?: number
    ): Promise<{ data: { log: AssetHolder; attachments: Attachment[] }[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, assetId, employeeId)

        const mapped = await Promise.all(data.map(async (log) => {
            const attachments = await this.attachmentService.getForEntity("AssetHolder", log.id)
            return { log, attachments }
        }))

        return { data: mapped, total }
    }

    async getById(id: number): Promise<{ log: AssetHolder; attachments: Attachment[] }> {
        const log = await this.repository.findById(id)
        if (!log) {
            throw new NotFoundException("Asset assignment record not found")
        }
        const attachments = await this.attachmentService.getForEntity("AssetHolder", id)
        return { log, attachments }
    }

    async findActiveByAssetId(assetId: number): Promise<{ log: AssetHolder; attachments: Attachment[] } | null> {
        const log = await this.repository.findActiveByAssetId(assetId)
        if (!log) return null
        const attachments = await this.attachmentService.getForEntity("AssetHolder", log.id)
        return { log, attachments }
    }

    async create(data: Partial<AssetHolder> & { attachmentIds?: number[] }): Promise<AssetHolder> {
        // Validate asset exists
        const assetRepo = AppDataSource.getRepository(Asset)
        const assetExists = await assetRepo.findOneBy({ id: data.assetId })
        if (!assetExists) {
            throw new NotFoundException("Asset not found")
        }

        // Validate employee exists
        const employeeRepo = AppDataSource.getRepository(Employee)
        const employeeExists = await employeeRepo.findOneBy({ id: data.employeeId })
        if (!employeeExists) {
            throw new NotFoundException("Employee not found")
        }

        // Check if there is an active holder for this asset
        const activeLog = await this.repository.findActiveByAssetId(data.assetId!)
        if (activeLog) {
            throw new BadRequestException("Asset is currently assigned and must be returned first")
        }

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            const log = await this.repository.save({
                assetId: data.assetId,
                employeeId: data.employeeId,
                assignedDate: data.assignedDate,
                assignNote: data.assignNote,
                createdByUserId: data.createdByUserId,
            }, queryRunner.manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetHolder", log.id, queryRunner.manager)
            }

            // Log Asset assignment
            await assetLogService.log({
                assetId: data.assetId!,
                action: "assign",
                description: `Asset assigned to employee "${employeeExists.name}".`,
                createdByUserId: data.createdByUserId,
            }, queryRunner.manager)

            await queryRunner.commitTransaction()

            // Reload and return
            const reloaded = await this.repository.findById(log.id)
            if (!reloaded) throw new NotFoundException("Created assignment could not be loaded")
            return reloaded
        } catch (err) {
            await queryRunner.rollbackTransaction()
            throw err
        } finally {
            await queryRunner.release()
        }
    }

    async returnAsset(id: number, data: { returnedDate: string; returnNote?: string; returnedByUserId?: number; attachmentIds?: number[] }): Promise<AssetHolder> {
        const { log } = await this.getById(id)
        if (log.returnedDate) {
            throw new BadRequestException("Asset has already been returned")
        }

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            log.returnedDate = data.returnedDate
            log.returnNote = data.returnNote || null
            log.returnedByUserId = data.returnedByUserId || null

            await this.repository.save(log, queryRunner.manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetHolder", log.id, queryRunner.manager)
            }

            // Log Asset return
            await assetLogService.log({
                assetId: log.assetId,
                action: "return",
                description: `Asset returned from employee "${log.employee.name}".`,
                createdByUserId: data.returnedByUserId,
            }, queryRunner.manager)

            await queryRunner.commitTransaction()

            // Reload and return
            const reloaded = await this.repository.findById(log.id)
            if (!reloaded) throw new NotFoundException("Updated assignment could not be loaded")
            return reloaded
        } catch (err) {
            await queryRunner.rollbackTransaction()
            throw err
        } finally {
            await queryRunner.release()
        }
    }
}
