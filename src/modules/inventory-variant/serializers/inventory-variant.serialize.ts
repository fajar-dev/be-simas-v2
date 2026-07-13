import { InventoryVariant } from "../entities/inventory-variant.entity"

export class InventoryVariantSerializer {
    static single(variant: InventoryVariant) {
        return {
            id: variant.id,
            inventoryId: variant.inventoryId,
            name: variant.name,
            code: variant.code || null,
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

    static collection(variants: InventoryVariant[]) {
        return variants.map((v) => this.single(v))
    }
}
