import { InventoryVariant } from "../entities/inventory-variant.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class InventoryVariantSerializer {
    static async single(variant: InventoryVariant) {
        return {
            id: variant.id,
            inventoryId: variant.inventoryId,
            name: variant.name,
            code: variant.code || null,
            image: await resolveFileUrl(variant.image),
            description: variant.description || null,
            isActive: variant.isActive,
            createdAt: variant.createdAt,
            updatedAt: variant.updatedAt,
            inventory: variant.inventory ? {
                id: variant.inventory.id,
                name: variant.inventory.name,
                code: variant.inventory.code || null,
            } : null,
        }
    }

    static async collection(variants: InventoryVariant[]) {
        return Promise.all(variants.map((v) => this.single(v)))
    }
}
