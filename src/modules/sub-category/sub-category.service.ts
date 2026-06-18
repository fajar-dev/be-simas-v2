import { SubCategory } from "./entities/sub-category.entity"
import { NotFoundException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { ISubCategoryRepository } from "./interfaces/sub-category.repository.interface"

export class SubCategoryService {
    constructor(private readonly repository: ISubCategoryRepository) {}

    async getAll(page: number, limit: number, q: string): Promise<{ data: SubCategory[]; total: number }> {
        return await this.repository.findAll(page, limit, q)
    }

    async getById(id: number): Promise<SubCategory> {
        const subCategory = await this.repository.findById(id)
        if (!subCategory) {
            throw new NotFoundException("Sub category not found")
        }
        return subCategory
    }

    async create(data: Partial<SubCategory>): Promise<SubCategory> {
        return await this.repository.save(data)
    }

    async update(id: number, data: Partial<SubCategory>): Promise<SubCategory> {
        const subCategory = await this.getById(id)
        this.repository.merge(subCategory, data)
        return await this.repository.save(subCategory)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        await this.repository.delete(id)
    }

    async save(data: Partial<SubCategory>, manager?: EntityManager): Promise<SubCategory> {
        return await this.repository.save(data, manager)
    }
}
