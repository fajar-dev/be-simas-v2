import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Category } from "../entities/category.entity"
import { ICategoryRepository } from "../interfaces/category.repository.interface"

export class CategoryRepository implements ICategoryRepository {
    private readonly repository: Repository<Category>

    constructor() {
        this.repository = AppDataSource.getRepository(Category)
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Category[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("category")
            .addSelect(subQuery => {
                return subQuery
                    .select("COUNT(a.id)", "count")
                    .from("assets", "a")
                    .innerJoin("sub_categories", "sc", "sc.id = a.sub_category_id")
                    .where("sc.category_id = category.id")
            }, "assetCount")

        if (q) {
            query.where(
                "(category.code LIKE :q OR category.name LIKE :q OR category.description LIKE :q)",
                { q: `%${q}%` }
            )
        }

        const total = await query.getCount()

        // Whitelist of allowed sort columns
        const sortColumnMap: Record<string, string> = {
            code: "category.code",
            name: "category.name",
            description: "category.description",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "category.id"
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

    async findById(id: number): Promise<Category | null> {
        return await this.repository.findOneBy({ id })
    }

    async findList(): Promise<Category[]> {
        return await this.repository.find({ order: { name: 'ASC' } })
    }

    async save(data: Partial<Category>, manager?: EntityManager): Promise<Category> {
        const repo = manager ? manager.getRepository(Category) : this.repository
        return await repo.save(data)
    }

    merge(entity: Category, data: Partial<Category>): Category {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
