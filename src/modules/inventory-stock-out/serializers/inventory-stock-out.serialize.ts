import { InventoryStockOut } from "../entities/inventory-stock-out.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class InventoryStockOutSerializer {
    static async single(h: InventoryStockOut, attachments: Attachment[] = []) {
        return {
            id: h.id,
            type: h.type,
            conditionAssigned: h.conditionAssigned,
            quantity: h.quantity,
            quantityReturned: h.quantityReturned,
            quantityRemaining: h.quantity - h.quantityReturned,
            assignedDate: h.assignedDate,
            returnedDate: h.returnedDate || null,
            assignNote: h.assignNote || null,
            returnNote: h.returnNote || null,
            assignHandoverId: h.assignHandoverId || null,
            returnHandoverId: h.returnHandoverId || null,
            employee: h.employee ? { id: h.employee.id, name: h.employee.name, employeeId: h.employee.employeeId } : null,
            branch: h.branch ? { id: h.branch.id, name: h.branch.name } : null,
            variant: h.variant ? {
                id: h.variant.id,
                name: h.variant.name,
                code: h.variant.code || null,
                unit: h.variant.inventory?.unit ?? "",
                inventory: h.variant.inventory ? { id: h.variant.inventory.id, name: h.variant.inventory.name, code: h.variant.inventory.code || null } : null,
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
        }
    }

    static async collection(items: { stockOut: InventoryStockOut; attachments: Attachment[] }[]) {
        return Promise.all(items.map((item) => this.single(item.stockOut, item.attachments)))
    }
}
