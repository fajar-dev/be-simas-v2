import { AssetHolder } from "./entities/asset-holder.entity"
import { IAssetHolderRepository } from "./interfaces/asset-holder.repository.interface"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { assetLogService } from "../asset-log/asset-log.module"
import type { AssetService } from "../asset/asset.service"
import type { EmployeeService } from "../employee/employee.service"
import { withTransaction } from "../../core/helpers/transaction"
import { EntityManager } from "typeorm"

export class AssetHolderService {
    constructor(
        private readonly repository: IAssetHolderRepository,
        private readonly attachmentService: AttachmentService,
        private readonly assetService: AssetService,
        private readonly employeeService: EmployeeService
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
        // Validate asset exists (throws NotFoundException if not found)
        await this.assetService.getById(data.assetId!)

        // Validate employee exists (throws NotFoundException if not found)
        const employee = await this.employeeService.getById(data.employeeId!)

        // Check if there is an active holder for this asset
        const activeLog = await this.repository.findActiveByAssetId(data.assetId!)
        if (activeLog) {
            throw new BadRequestException("Asset is currently assigned and must be returned first")
        }

        const log = await withTransaction(async (manager) => {
            const log = await this.repository.save({
                assetId: data.assetId,
                employeeId: data.employeeId,
                assignedDate: data.assignedDate,
                assignNote: data.assignNote,
                createdByUserId: data.createdByUserId,
            }, manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetHolder", log.id, manager)
            }

            // Log Asset assignment
            await assetLogService.log({
                assetId: data.assetId!,
                module: "holder",
                action: "assign",
                description: `Asset assigned to employee "${employee.name}".`,
                createdByUserId: data.createdByUserId,
                newValue: data,
            }, manager)

            return log
        })

        // Reload and return
        const reloaded = await this.repository.findById(log.id)
        if (!reloaded) throw new NotFoundException("Created assignment could not be loaded")
        return reloaded
    }

    async returnAsset(id: number, data: { returnedDate: string; returnNote?: string; returnedByUserId?: number; attachmentIds?: number[] }): Promise<AssetHolder> {
        const { log } = await this.getById(id)
        if (log.returnedDate) {
            throw new BadRequestException("Asset has already been returned")
        }

        await withTransaction(async (manager) => {
            log.returnedDate = data.returnedDate
            log.returnNote = data.returnNote || null
            log.returnedByUserId = data.returnedByUserId || null

            await this.repository.save(log, manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetHolder", log.id, manager)
            }

            // Log Asset return
            await assetLogService.log({
                assetId: log.assetId,
                module: "holder",
                action: "return",
                description: `Asset returned from employee "${log.employee.name}".`,
                createdByUserId: data.returnedByUserId,
                oldValue: { ...log },
                newValue: data,
            }, manager)
        })

        // Reload and return
        const reloaded = await this.repository.findById(log.id)
        if (!reloaded) throw new NotFoundException("Updated assignment could not be loaded")
        return reloaded
    }

    async findActiveHolder(assetId: number): Promise<AssetHolder | null> {
        return await this.repository.findActiveByAssetId(assetId)
    }

    async save(data: Partial<AssetHolder>, manager?: EntityManager): Promise<AssetHolder> {
        return await this.repository.save(data, manager)
    }
}
