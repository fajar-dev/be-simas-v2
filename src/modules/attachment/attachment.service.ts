import { Attachment } from "./entities/attachment.entity"
import { IAttachmentRepository } from "./interfaces/attachment.repository.interface"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { minio } from "../../core/helpers/minio"
import { EntityManager } from "typeorm"
import crypto from "crypto"

export class AttachmentService {
    constructor(private readonly repository: IAttachmentRepository) {}

    async getById(id: number): Promise<Attachment> {
        const attachment = await this.repository.findById(id)
        if (!attachment) {
            throw new NotFoundException("Attachment not found")
        }
        return attachment
    }

    async upload(file: File): Promise<Attachment> {
        if (!file || !(file instanceof File) || file.size === 0) {
            throw new BadRequestException("Invalid file uploaded")
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const extension = file.name.split(".").pop() || ""
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_")
        const objectName = `attachments/${crypto.randomUUID()}_${cleanName}`

        // Upload to MinIO
        await minio.upload(objectName, buffer, file.type)

        // Save metadata to DB
        return await this.repository.save({
            originalName: file.name,
            filename: objectName,
            mimeType: file.type,
            size: file.size,
        })
    }

    async delete(id: number, manager?: EntityManager): Promise<void> {
        const attachment = await this.getById(id)
        
        // Delete from MinIO
        try {
            await minio.delete(attachment.filename)
        } catch (error) {
            console.error(`[AttachmentService] Failed to delete file ${attachment.filename} from MinIO:`, error)
        }

        // Delete from DB
        await this.repository.delete(id, manager)
    }

    async associate(ids: number[], entityType: string, entityId: number, manager?: EntityManager): Promise<void> {
        if (!ids || ids.length === 0) return

        const attachments = await this.repository.findManyByIds(ids)
        for (const attachment of attachments) {
            attachment.entityType = entityType
            attachment.entityId = entityId
            await this.repository.save(attachment, manager)
        }
    }

    async getForEntity(entityType: string, entityId: number): Promise<Attachment[]> {
        return await this.repository.findByEntity(entityType, entityId)
    }

    async disassociateOrphans(entityType: string, entityId: number, activeIds: number[], manager?: EntityManager): Promise<void> {
        const existing = await this.repository.findByEntity(entityType, entityId)
        const activeSet = new Set(activeIds)

        for (const attachment of existing) {
            if (!activeSet.has(attachment.id)) {
                // Delete orphaned attachment
                await this.delete(attachment.id, manager)
            }
        }
    }
}
