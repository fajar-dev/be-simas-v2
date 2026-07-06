import { AssetNote } from "./entities/asset-note.entity"
import { IAssetNoteRepository } from "./interfaces/asset-note.repository.interface"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { assetLogService } from "../asset-log/asset-log.module"
import type { AssetService } from "../asset/asset.service"
import { withTransaction } from "../../core/helpers/transaction"

export class AssetNoteService {
    constructor(
        private readonly repository: IAssetNoteRepository,
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
    ): Promise<{ data: { note: AssetNote; attachments: Attachment[] }[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, assetId)

        const labelsMap = await this.repository.getLabelsForEntities("AssetNote", data.map(d => d.id))

        const mapped = await Promise.all(data.map(async (note) => {
            const attachments = await this.attachmentService.getForEntity("AssetNote", note.id)
            ;(note as any).labels = labelsMap.get(note.id) || []
            return { note, attachments }
        }))

        return { data: mapped, total }
    }

    async getById(id: number): Promise<{ note: AssetNote; attachments: Attachment[] }> {
        const note = await this.repository.findById(id)
        if (!note) {
            throw new NotFoundException("Asset note record not found")
        }

        const attachments = await this.attachmentService.getForEntity("AssetNote", id)
        ;(note as any).labels = await this.repository.getLabelsForEntity("AssetNote", id)
        return { note, attachments }
    }

    async create(data: Partial<AssetNote> & { attachmentIds?: number[] }): Promise<AssetNote> {
        // Validate asset exists (throws NotFoundException if not found)
        await this.assetService.getById(data.assetId!)

        const note = await withTransaction(async (manager) => {
            const note = await this.repository.save({
                assetId: data.assetId,
                date: data.date,
                note: data.note,
                createdByUserId: data.createdByUserId,
            }, manager)

            if (data.attachmentIds && data.attachmentIds.length > 0) {
                await this.attachmentService.associate(data.attachmentIds, "AssetNote", note.id, manager)
            }

            if ((data as any).labels && (data as any).labels.length > 0) {
                await this.repository.saveLabels("AssetNote", note.id, (data as any).labels, manager)
            }

            // Log Asset note creation
            await assetLogService.log({
                assetId: data.assetId!,
                module: "note",
                action: "create",
                description: `Note recorded: ${data.note || "No notes"}.`,
                createdByUserId: data.createdByUserId,
                newValue: data,
            }, manager)

            return note
        })

        // Reload with relations (including labels)
        const { note: reloaded } = await this.getById(note.id)
        return reloaded
    }

    async update(id: number, data: Partial<AssetNote> & { attachmentIds?: number[] }, operatorId?: number): Promise<AssetNote> {
        const { note } = await this.getById(id)

        if (data.assetId && data.assetId !== note.assetId) {
            // Validate new asset exists (throws NotFoundException if not found)
            await this.assetService.getById(data.assetId)
        }

        await withTransaction(async (manager) => {
            this.repository.merge(note, {
                assetId: data.assetId,
                date: data.date,
                note: data.note,
            })
            
            await this.repository.save(note, manager)

            if (data.attachmentIds !== undefined) {
                // Delete orphaned attachments (those not in the list anymore)
                await this.attachmentService.disassociateOrphans("AssetNote", id, data.attachmentIds, manager)
                // Associate new attachments
                await this.attachmentService.associate(data.attachmentIds, "AssetNote", id, manager)
            }

            if ((data as any).labels !== undefined) {
                await this.repository.deleteLabels("AssetNote", id, manager)
                if ((data as any).labels && (data as any).labels.length > 0) {
                    await this.repository.saveLabels("AssetNote", id, (data as any).labels, manager)
                }
            }

            // Log Asset note update
            await assetLogService.log({
                assetId: note.assetId,
                module: "note",
                action: "update",
                description: `Note updated: ${data.note || note.note || "No notes"}.`,
                createdByUserId: operatorId,
                oldValue: { ...note },
                newValue: data,
            }, manager)
        })

        // Reload with relations
        const reloaded = await this.repository.findById(id)
        if (!reloaded) throw new NotFoundException("Updated record could not be loaded")
        return reloaded
    }

    async delete(id: number, operatorId?: number): Promise<void> {
        const { note } = await this.getById(id)

        await withTransaction(async (manager) => {
            // Delete all associated files & db entries
            await this.attachmentService.disassociateOrphans("AssetNote", id, [], manager)
            // Delete associated labels
            await this.repository.deleteLabels("AssetNote", id, manager)
            // Delete record
            await this.repository.delete(id, manager)

            // Log Asset note deletion
            await assetLogService.log({
                assetId: note.assetId,
                module: "note",
                action: "delete",
                description: `Note deleted: ${note.note || "No notes"}.`,
                createdByUserId: operatorId,
                oldValue: { ...note },
            }, manager)
        })
    }

    async getUniqueLabelKeys(assetId?: number): Promise<string[]> {
        return this.repository.getUniqueLabelKeys("AssetNote", assetId)
    }
}
