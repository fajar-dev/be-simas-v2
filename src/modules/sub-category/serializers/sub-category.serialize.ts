import { SubCategory } from "../entities/sub-category.entity"

export class SubCategorySerializer {
    static single(subCategory: SubCategory) {
        return {
            id: subCategory.id,
            code: subCategory.code,
            name: subCategory.name,
            description: subCategory.description || null,
            category: subCategory.category ? {
                id: subCategory.category.id,
                name: subCategory.category.name,
            } : null,
            createdAt: subCategory.createdAt,
            updatedAt: subCategory.updatedAt,
        }
    }

    static collection(subCategories: SubCategory[]) {
        return subCategories.map(sc => this.single(sc))
    }
}
