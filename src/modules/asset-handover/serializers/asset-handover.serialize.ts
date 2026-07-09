import { AssetHandover } from "../entities/asset-handover.entity"
import { AssetHandoverItem } from "../entities/asset-handover-item.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class AssetHandoverSerializer {

    private static async item(item: AssetHandoverItem) {
        return {
            id: item.id,
            note: item.note || null,
            asset: item.asset ? {
                id: item.asset.id,
                name: item.asset.name,
                code: item.asset.code,
                image: await resolveFileUrl(item.asset.image),
            } : null,
        }
    }

    static async single(handover: AssetHandover, attachments: Attachment[] = []) {
        return {
            id: handover.id,
            received: handover.receivedBy ? {
                id: handover.receivedBy.id,
                name: handover.receivedBy.name,
                employeeId: handover.receivedBy.employeeId,
                jobPosition: handover.receivedBy.jobPosition,
                photo: await resolveFileUrl(handover.receivedBy.photo),
            } : null,
            handedOver: handover.handedOverBy ? {
                id: handover.handedOverBy.id,
                name: handover.handedOverBy.name,
                employeeId: handover.handedOverBy.employeeId,
                jobPosition: handover.handedOverBy.jobPosition,
                photo: await resolveFileUrl(handover.handedOverBy.photo),
            } : null,
            status: handover.status,
            transactionType: handover.transactionType,
            category: handover.category,
            note: handover.note || null,
            estimatedReturnDate: handover.estimatedReturnDate || null,
            createdAt: handover.createdAt,
            updatedAt: handover.updatedAt,
            createdBy: handover.createdBy ? {
                id: handover.createdBy.id,
                name: handover.createdBy.name,
                photo: await resolveFileUrl(handover.createdBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
            items: await Promise.all((handover.items || []).map((item) => this.item(item))),
        }
    }

    static async collection(items: { handover: AssetHandover; attachments: Attachment[] }[]) {
        return Promise.all(items.map((i) => this.single(i.handover, i.attachments)))
    }
}
