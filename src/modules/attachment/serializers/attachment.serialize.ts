import { Attachment } from "../entities/attachment.entity"
import { minio } from "../../../core/helpers/minio"

export class AttachmentSerializer {
    static async single(attachment: Attachment) {
        return {
            id: attachment.id,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            url: await minio.getPresignedUrl(attachment.filename),
            createdAt: attachment.createdAt,
            updatedAt: attachment.updatedAt,
        }
    }

    static async collection(attachments: Attachment[]) {
        return Promise.all(attachments.map((a) => this.single(a)))
    }
}
