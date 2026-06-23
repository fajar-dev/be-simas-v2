import { AssetHolder } from "../entities/asset-holder.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class AssetHolderSerializer {

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
                photo: await resolveFileUrl(log.employee.photo),
            } : null,
            createdBy: log.createdBy ? {
                id: log.createdBy.id,
                name: log.createdBy.name,
                photo: await resolveFileUrl(log.createdBy.photo),
            } : null,
            returnedBy: log.returnedBy ? {
                id: log.returnedBy.id,
                name: log.returnedBy.name,
                photo: await resolveFileUrl(log.returnedBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
        }
    }

    static async collection(items: { log: AssetHolder; attachments: Attachment[] }[]) {
        return Promise.all(items.map(item => this.single(item.log, item.attachments)))
    }
}
