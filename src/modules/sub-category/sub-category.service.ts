import { SubCategory } from "./entities/sub-category.entity"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { AppDataSource } from "../../config/database"
import { Asset } from "../asset/entities/asset.entity"
import { ISubCategoryRepository } from "./interfaces/sub-category.repository.interface"

export class SubCategoryService {
    constructor(private readonly repository: ISubCategoryRepository) {}

    async getAll(page: number, limit: number, q: string, categoryId?: number, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: SubCategory[]; total: number }> {
        return await this.repository.findAll(page, limit, q, categoryId, sortBy, order)
    }

    async getByCategoryId(categoryId: number): Promise<SubCategory[]> {
        return await this.repository.findByCategoryId(categoryId)
    }

    async getById(id: number): Promise<SubCategory> {
        const subCategory = await this.repository.findById(id)
        if (!subCategory) {
            throw new NotFoundException("Sub category not found")
        }
        return subCategory
    }

    async create(data: Partial<SubCategory>): Promise<SubCategory> {
        const saved = await this.repository.save(data)
        if (!data.code) {
            saved.code = String(saved.id)
            return await this.repository.save(saved)
        }
        return saved
    }

    async update(id: number, data: Partial<SubCategory>): Promise<SubCategory> {
        const subCategory = await this.getById(id)
        this.repository.merge(subCategory, data)
        return await this.repository.save(subCategory)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        const assetCount = await AppDataSource.getRepository(Asset).count({ where: { subCategoryId: id } })
        if (assetCount > 0) {
            throw new ConflictException(`Cannot delete sub category, ${assetCount} asset(s) are still linked to this sub category`)
        }
        await this.repository.delete(id)
    }

    async save(data: Partial<SubCategory>, manager?: EntityManager): Promise<SubCategory> {
        return await this.repository.save(data, manager)
    }
}
