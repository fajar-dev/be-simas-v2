import { AssetMaintenance } from "../entities/asset-maintenance.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class AssetMaintenanceSerializer {

    static async single(maintenance: AssetMaintenance, attachments: Attachment[] = []) {
        return {
            id: maintenance.id,
            assetId: maintenance.assetId,
            date: maintenance.date,
            note: maintenance.note,
            cost: Number(maintenance.cost ?? 0),
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
                photo: await resolveFileUrl(maintenance.createdBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
            labels: ((maintenance as any).labels || []).map((l: any) => ({ id: l.id, key: l.key, value: l.value })),
        }
    }

    static async collection(items: { maintenance: AssetMaintenance; attachments: Attachment[] }[]) {
        return Promise.all(items.map(item => this.single(item.maintenance, item.attachments)))
    }
}
