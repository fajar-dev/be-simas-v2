import { Attachment } from "../entities/attachment.entity"
import { minio } from "../../../core/helpers/minio"

export class AttachmentSerializer {
    private static async resolveUrl(filename: string): Promise<string | null> {
        if (!filename) return null
        return await minio.getPresignedUrl(filename)
    }

    static async single(attachment: Attachment) {
        return {
            id: attachment.id,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            url: await this.resolveUrl(attachment.filename),
            createdAt: attachment.createdAt,
            updatedAt: attachment.updatedAt,
        }
    }

    static async collection(attachments: Attachment[]) {
        return Promise.all(attachments.map((a) => this.single(a)))
    }
}
