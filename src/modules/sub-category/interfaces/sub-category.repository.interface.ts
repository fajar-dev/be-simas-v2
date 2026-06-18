import { EntityManager } from "typeorm"
import { SubCategory } from "../entities/sub-category.entity"

export interface ISubCategoryRepository {
    findAll(page: number, limit: number, q: string, categoryId?: number): Promise<{ data: SubCategory[]; total: number }>
    findByCategoryId(categoryId: number): Promise<SubCategory[]>
    findById(id: number): Promise<SubCategory | null>
    save(data: Partial<SubCategory>, manager?: EntityManager): Promise<SubCategory>
    merge(entity: SubCategory, data: Partial<SubCategory>): SubCategory
    delete(id: number): Promise<void>
}
