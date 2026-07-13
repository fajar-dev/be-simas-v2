import { Inventory } from "../entities/inventory.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"
import { attachmentService } from "../../attachment/attachment.module"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"

export class InventorySerializer {
    static async single(item: Inventory) {
        return {
            id: item.id,
            code: item.code || null,
            name: item.name,
            description: item.description || null,
            image: await resolveFileUrl(item.image),
            unit: item.unit,
            isActive: item.isActive,
            category: item.subCategory?.category
                ? { id: item.subCategory.category.id, name: item.subCategory.category.name }
                : null,
            subCategory: item.subCategory
                ? { id: item.subCategory.id, name: item.subCategory.name }
                : null,
            labels: (item.labels || []).map((l) => ({ id: l.id, key: l.key, value: l.value })),
            variantCount: item.variantCount ?? 0,
            balanceCount: item.balanceCount ?? 0,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            createdBy: item.createdBy ? {
                id: item.createdBy.id,
                name: item.createdBy.name,
                photo: await resolveFileUrl(item.createdBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(await attachmentService.getForEntity("Inventory", item.id)),
        }
    }

    static async collection(items: Inventory[]) {
        return Promise.all(items.map((p) => this.single(p)))
    }
}
