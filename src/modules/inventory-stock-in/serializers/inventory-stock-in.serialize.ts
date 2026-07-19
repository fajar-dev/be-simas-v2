import { InventoryStockIn } from "../entities/inventory-stock-in.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class InventoryStockInSerializer {

    static async single(s: InventoryStockIn, attachments: Attachment[] = []) {
        return {
            id: s.id,
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
                quantity: item.quantity,
                balanceAfter: item.balanceAfter ?? null,
                branch: item.branch ? { id: item.branch.id, name: item.branch.name } : null,
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

    static async collection(items: { stockIn: InventoryStockIn; attachments: Attachment[] }[]) {
        return Promise.all(items.map((i) => this.single(i.stockIn, i.attachments)))
    }
}
