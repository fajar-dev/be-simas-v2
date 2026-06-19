import { AssetHolder } from "../entities/asset-holder.entity"
import { minio } from "../../../core/helpers/minio"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class AssetHolderSerializer {
    private static async resolvePhotoUrl(photo?: string | null): Promise<string | null> {
        if (!photo) return null
        return await minio.getPresignedUrl(photo)
    }

    static async single(log: AssetHolder, attachments: Attachment[] = []) {
        return {
            id: log.id,
            assetId: log.assetId,
            employeeId: log.employeeId,
            assignedDate: log.assignedDate,
            returnedDate: log.returnedDate || null,
            assignNote: log.assignNote || null,
            returnNote: log.returnNote || null,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
            asset: log.asset ? {
                id: log.asset.id,
                name: log.asset.name,
                code: log.asset.code,
            } : null,
            employee: log.employee ? {
                id: log.employee.id,
                name: log.employee.name,
                employeeId: log.employee.employeeId,
                jobPosition: log.employee.jobPosition,
                email: log.employee.email,
                phone: log.employee.phone,
                photo: await this.resolvePhotoUrl(log.employee.photo),
            } : null,
            createdBy: log.createdBy ? {
                id: log.createdBy.id,
                name: log.createdBy.name,
                photo: await this.resolvePhotoUrl(log.createdBy.photo),
            } : null,
            returnedBy: log.returnedBy ? {
                id: log.returnedBy.id,
                name: log.returnedBy.name,
                photo: await this.resolvePhotoUrl(log.returnedBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
        }
    }

    static async collection(items: { log: AssetHolder; attachments: Attachment[] }[]) {
        return Promise.all(items.map(item => this.single(item.log, item.attachments)))
    }
}
