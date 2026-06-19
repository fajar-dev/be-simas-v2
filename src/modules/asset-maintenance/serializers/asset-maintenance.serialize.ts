import { AssetMaintenance } from "../entities/asset-maintenance.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"
import { minio } from "../../../core/helpers/minio"

export class AssetMaintenanceSerializer {
    private static async resolvePhotoUrl(photo?: string | null): Promise<string | null> {
        if (!photo) return null
        return await minio.getPresignedUrl(photo)
    }

    static async single(maintenance: AssetMaintenance, attachments: Attachment[] = []) {
        return {
            id: maintenance.id,
            assetId: maintenance.assetId,
            date: maintenance.date,
            note: maintenance.note || null,
            createdAt: maintenance.createdAt,
            updatedAt: maintenance.updatedAt,
            asset: maintenance.asset ? {
                id: maintenance.asset.id,
                name: maintenance.asset.name,
                code: maintenance.asset.code,
            } : null,
            createdBy: maintenance.createdBy ? {
                id: maintenance.createdBy.id,
                name: maintenance.createdBy.name,
                photo: await this.resolvePhotoUrl(maintenance.createdBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
        }
    }

    static async collection(items: { maintenance: AssetMaintenance; attachments: Attachment[] }[]) {
        return Promise.all(items.map(item => this.single(item.maintenance, item.attachments)))
    }
}
