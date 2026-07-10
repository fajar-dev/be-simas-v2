import { InventoryVariant } from "../entities/inventory-variant.entity"

export class InventoryVariantSerializer {
    static single(variant: InventoryVariant) {
        return {
            id: variant.id,
            productId: variant.productId,
            name: variant.name,
            code: variant.code || null,
            unit: variant.unit,
            isActive: variant.isActive,
            createdAt: variant.createdAt,
            updatedAt: variant.updatedAt,
            product: variant.product ? {
                id: variant.product.id,
                name: variant.product.name,
                code: variant.product.code || null,
            } : null,
        }
    }

    static collection(variants: InventoryVariant[]) {
        return variants.map((v) => this.single(v))
    }
}
