import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class InventoryStockOutSerializer {
    static async single(s: InventoryStockOut, attachments: Attachment[] = []) {
        return {
            id: s.id,
            isEmployee: s.isEmployee,
            assignedDate: s.assignedDate,
            assignNote: s.assignNote || null,
            assignHandoverId: s.assignHandoverId || null,
            employee: s.employee ? { id: s.employee.id, name: s.employee.name, employeeId: s.employee.employeeId } : null,
            createdAt: s.createdAt,
            createdBy: s.createdBy ? {
                id: s.createdBy.id,
                name: s.createdBy.name,
                photo: await resolveFileUrl(s.createdBy.photo),
            } : null,
            items: (s.items ?? []).map((item) => ({
                id: item.id,
                conditionAssigned: item.conditionAssigned,
                quantity: item.quantity,
                quantityReturned: item.quantityReturned,
                quantityRemaining: item.quantity - item.quantityReturned,
                returnedDate: item.returnedDate || null,
                returnNote: item.returnNote || null,
                returnHandoverId: item.returnHandoverId || null,
                branch: item.branch ? { id: item.branch.id, name: item.branch.name } : null,
                variant: item.variant ? {
                    id: item.variant.id,
                    name: item.variant.name,
                    code: item.variant.code || null,
                    unit: item.variant.inventory?.unit ?? "",
                    inventory: item.variant.inventory ? { id: item.variant.inventory.id, name: item.variant.inventory.name, code: item.variant.inventory.code || null } : null,
                } : null,
            })),
            attachments: await AttachmentSerializer.collection(attachments),
        }
    }

    static async collection(items: { stockOut: InventoryStockOut; attachments: Attachment[] }[]) {
        return Promise.all(items.map((item) => this.single(item.stockOut, item.attachments)))
    }
}
