import { Category } from "../entities/category.entity"

export class CategorySerializer {
    static single(category: Category) {
        return {
            id: category.id,
            code: category.code,
            name: category.name,
            description: category.description || null,
            assetCount: (category as any).assetCount ?? 0,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        }
    }

    static collection(categories: Category[]) {
        return categories.map(c => this.single(c))
    }

    static listItem(category: Category) {
        return { id: category.id, name: category.name }
    }

    static listCollection(categories: Category[]) {
        return categories.map(c => this.listItem(c))
    }
}
