import { EntityManager } from "typeorm"
import { Category } from "../entities/category.entity"

export interface ICategoryRepository {
    findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Category[]; total: number }>
    findById(id: number): Promise<Category | null>
    save(data: Partial<Category>, manager?: EntityManager): Promise<Category>
    merge(entity: Category, data: Partial<Category>): Category
    delete(id: number): Promise<void>
}
