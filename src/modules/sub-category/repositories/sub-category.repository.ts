import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { SubCategory } from "../entities/sub-category.entity"
import { ISubCategoryRepository } from "../interfaces/sub-category.repository.interface"

export class SubCategoryRepository implements ISubCategoryRepository {
    private readonly repository: Repository<SubCategory>

    constructor() {
        this.repository = AppDataSource.getRepository(SubCategory)
    }

    async findAll(page: number, limit: number, q: string, categoryId?: number, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: SubCategory[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("sub_category")
            .leftJoinAndSelect("sub_category.category", "category")
            .addSelect(subQuery => {
                return subQuery
                    .select("COUNT(a.id)", "count")
                    .from("assets", "a")
                    .where("a.sub_category_id = sub_category.id")
            }, "assetCount")

        if (q) {
            query.where(
                "(sub_category.code LIKE :q OR sub_category.name LIKE :q OR sub_category.description LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (categoryId) {
            query.andWhere("sub_category.categoryId = :categoryId", { categoryId })
        }

        const total = await query.getCount()

        // Whitelist of allowed sort columns
        const sortColumnMap: Record<string, string> = {
            code: "sub_category.code",
            name: "sub_category.name",
            category: "category.name",
            description: "sub_category.description",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "sub_category.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getRawAndEntities()

        const result = data.entities.map((entity, i) => {
            (entity as any).assetCount = parseInt(data.raw[i].assetCount || '0', 10)
            return entity
        })

        return { data: result, total }
    }

    async findByCategoryId(categoryId: number): Promise<SubCategory[]> {
        return await this.repository.find({
            where: { categoryId },
            relations: ["category"],
            order: { name: "ASC" }
        })
    }

    async findById(id: number): Promise<SubCategory | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["category"]
        })
    }

    async save(data: Partial<SubCategory>, manager?: EntityManager): Promise<SubCategory> {
        const repo = manager ? manager.getRepository(SubCategory) : this.repository
        return await repo.save(data)
    }

    merge(entity: SubCategory, data: Partial<SubCategory>): SubCategory {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
