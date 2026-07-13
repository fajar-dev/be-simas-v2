import { Inventory } from "../entities/inventory.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class InventorySerializer {
    static async single(product: Inventory) {
        return {
            id: product.id,
            code: product.code || null,
            name: product.name,
            description: product.description || null,
            image: await resolveFileUrl(product.image),
            unit: product.unit,
            isActive: product.isActive,
            category: product.subCategory?.category
                ? { id: product.subCategory.category.id, name: product.subCategory.category.name }
                : null,
            subCategory: product.subCategory
                ? { id: product.subCategory.id, name: product.subCategory.name }
                : null,
            labels: (product.labels || []).map((l) => ({ id: l.id, key: l.key, value: l.value })),
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            createdBy: product.createdBy ? {
                id: product.createdBy.id,
                name: product.createdBy.name,
                photo: await resolveFileUrl(product.createdBy.photo),
            } : null,
        }
    }

    static async collection(products: Inventory[]) {
        return Promise.all(products.map((p) => this.single(p)))
    }
}
