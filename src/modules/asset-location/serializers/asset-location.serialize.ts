import { AssetLocation } from "../entities/asset-location.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class AssetLocationSerializer {

    static async single(log: AssetLocation, attachments: Attachment[] = []) {
        return {
            id: log.id,
            date: log.date,
            note: log.note || null,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
            asset: log.asset ? {
                id: log.asset.id,
                name: log.asset.name,
                code: log.asset.code,
            } : null,
            location: log.location ? {
                id: log.location.id,
                name: log.location.name,
                description: log.location.description || null,
                branch: log.location.branch ? {
                    id: log.location.branch.id,
                    name: log.location.branch.name,
                    code: log.location.branch.code,
                } : null,
            } : null,
            createdBy: log.createdBy ? {
                id: log.createdBy.id,
                name: log.createdBy.name,
                photo: await resolveFileUrl(log.createdBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
        }
    }

    static async collection(items: { log: AssetLocation; attachments: Attachment[] }[]) {
        return Promise.all(items.map(item => this.single(item.log, item.attachments)))
    }
}
