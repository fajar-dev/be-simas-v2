import { InventoryStockOpname } from "../entities/inventory-stock-opname.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class InventoryStockOpnameSerializer {

    static async single(s: InventoryStockOpname, attachments: Attachment[] = []) {
        return {
            id: s.id,
            branch: s.branch ? { id: s.branch.id, name: s.branch.name } : null,
            note: s.note || null,
            createdAt: s.createdAt,
            createdBy: s.createdBy ? {
                id: s.createdBy.id,
                name: s.createdBy.name,
                photo: await resolveFileUrl(s.createdBy.photo),
            } : null,
            items: (s.items ?? []).map((item) => ({
                id: item.id,
                condition: item.condition,
                systemQuantity: item.systemQuantity,
                countedQuantity: item.countedQuantity,
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

    static async collection(items: { opname: InventoryStockOpname; attachments: Attachment[] }[]) {
        return Promise.all(items.map((i) => this.single(i.opname, i.attachments)))
    }
}
