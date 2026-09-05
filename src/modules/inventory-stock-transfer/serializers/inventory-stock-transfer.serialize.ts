import { InventoryStockTransfer } from "../entities/inventory-stock-transfer.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class InventoryStockTransferSerializer {

    static async single(t: InventoryStockTransfer, attachments: Attachment[] = []) {
        return {
            id: t.id,
            note: t.note || null,
            createdAt: t.createdAt,
            fromBranch: t.fromBranch ? { id: t.fromBranch.id, name: t.fromBranch.name } : null,
            toBranch: t.toBranch ? { id: t.toBranch.id, name: t.toBranch.name } : null,
            createdBy: t.createdBy ? {
                id: t.createdBy.id,
                name: t.createdBy.name,
                photo: await resolveFileUrl(t.createdBy.photo),
            } : null,
            items: (t.items ?? []).map((item) => ({
                id: item.id,
                condition: item.condition,
                quantity: item.quantity,
                variant: item.variant ? {
                    id: item.variant.id,
                    name: item.variant.name,
                    code: item.variant.code || null,
                    inventory: item.variant.inventory ? { id: item.variant.inventory.id, name: item.variant.inventory.name } : null,
                } : null,
            })),
            attachments: await AttachmentSerializer.collection(attachments),
        }
    }

    static async collection(items: { transfer: InventoryStockTransfer; attachments: Attachment[] }[]) {
        return Promise.all(items.map((i) => this.single(i.transfer, i.attachments)))
    }
}
