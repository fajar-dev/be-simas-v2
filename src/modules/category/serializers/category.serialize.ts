import { Category } from "../entities/category.entity"

export class CategorySerializer {
    static single(category: Category) {
        return {
            id: category.id,
            name: category.name,
            description: category.description || null,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        }
    }

    static collection(categories: Category[]) {
        return categories.map(c => this.single(c))
    }
}
