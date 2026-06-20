import { Category } from "./entities/category.entity"
import { NotFoundException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { ICategoryRepository } from "./interfaces/category.repository.interface"

export class CategoryService {
    constructor(private readonly repository: ICategoryRepository) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Category[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order)
    }

    async getById(id: number): Promise<Category> {
        const category = await this.repository.findById(id)
        if (!category) {
            throw new NotFoundException("Category not found")
        }
        return category
    }

    async create(data: Partial<Category>): Promise<Category> {
        const saved = await this.repository.save(data)
        if (!data.code) {
            saved.code = String(saved.id)
            return await this.repository.save(saved)
        }
        return saved
    }

    async update(id: number, data: Partial<Category>): Promise<Category> {
        const category = await this.getById(id)
        this.repository.merge(category, data)
        return await this.repository.save(category)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        await this.repository.delete(id)
    }

    async save(data: Partial<Category>, manager?: EntityManager): Promise<Category> {
        return await this.repository.save(data, manager)
    }
}
