import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Inventory } from "../entities/inventory.entity"
import { InventoryLabel } from "../entities/inventory-label.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { IInventoryRepository, InventoryFilter } from "../interfaces/inventory.repository.interface"

const RELATIONS = ["createdBy", "subCategory", "subCategory.category", "labels"]

// Correlated subqueries: number of variants, and on-hand stock per condition, per item.
const VARIANT_COUNT_SQL = "(SELECT COUNT(*) FROM inventory_variants iv WHERE iv.inventory_id = item.id)"
const NEW_COUNT_SQL = "(SELECT COALESCE(SUM(bal.quantity), 0) FROM inventory_stock_balances bal INNER JOIN inventory_variants ivb ON bal.variant_id = ivb.id WHERE ivb.inventory_id = item.id AND bal.condition = 'new')"
const USED_COUNT_SQL = "(SELECT COALESCE(SUM(bal.quantity), 0) FROM inventory_stock_balances bal INNER JOIN inventory_variants ivb ON bal.variant_id = ivb.id WHERE ivb.inventory_id = item.id AND bal.condition = 'used')"

export class TypeOrmInventoryRepository implements IInventoryRepository {
    private readonly repository: Repository<Inventory>
    private readonly labelRepository: Repository<InventoryLabel>

    constructor() {
        this.repository = AppDataSource.getRepository(Inventory)
        this.labelRepository = AppDataSource.getRepository(InventoryLabel)
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: InventoryFilter): Promise<{ data: Inventory[]; total: number }> {
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'
        const sortColumnMap: Record<string, string> = {
            code: "item.code",
            name: "item.name",
            createdAt: "item.createdAt",
            unit: "item.unit",
            category: "category.name",
            subCategory: "subCategory.name",
            variantCount: "variantCount",
            newCount: "newCount",
            usedCount: "usedCount",
        }
        const sortColumn = sortColumnMap[sortBy || ''] || "item.id"

        // 1) Resolve the page's item ids (+ counts) with one row per item, so
        //    pagination/sorting are correct even with the one-to-many labels relation.
        const idQuery = this.repository.createQueryBuilder("item")
            .leftJoin("item.subCategory", "subCategory")
            .leftJoin("subCategory.category", "category")
            .select("item.id", "id")
            .addSelect(VARIANT_COUNT_SQL, "variantCount")
            .addSelect(NEW_COUNT_SQL, "newCount")
            .addSelect(USED_COUNT_SQL, "usedCount")

        if (q) {
            idQuery.where("(item.code LIKE :q OR item.name LIKE :q OR item.description LIKE :q)", { q: `%${q}%` })
        }

        if (filters?.categoryIds?.length) {
            idQuery.andWhere("subCategory.categoryId IN (:...categoryIds)", { categoryIds: filters.categoryIds })
        }
        if (filters?.subCategoryIds?.length) {
            idQuery.andWhere("item.subCategoryId IN (:...subCategoryIds)", { subCategoryIds: filters.subCategoryIds })
        }
        if (filters?.units?.length) {
            idQuery.andWhere("item.unit IN (:...units)", { units: filters.units })
        }
        if (filters?.isActive !== undefined) {
            idQuery.andWhere("item.isActive = :isActive", { isActive: filters.isActive })
        }
        if (filters?.variantStatus === 'has_variants') {
            idQuery.andWhere(`${VARIANT_COUNT_SQL} > 0`)
        }
        if (filters?.variantStatus === 'no_variants') {
            idQuery.andWhere(`${VARIANT_COUNT_SQL} = 0`)
        }
        if (filters?.newStockMin !== undefined) {
            idQuery.andWhere(`${NEW_COUNT_SQL} >= :newStockMin`, { newStockMin: filters.newStockMin })
        }
        if (filters?.newStockMax !== undefined) {
            idQuery.andWhere(`${NEW_COUNT_SQL} <= :newStockMax`, { newStockMax: filters.newStockMax })
        }
        if (filters?.usedStockMin !== undefined) {
            idQuery.andWhere(`${USED_COUNT_SQL} >= :usedStockMin`, { usedStockMin: filters.usedStockMin })
        }
        if (filters?.usedStockMax !== undefined) {
            idQuery.andWhere(`${USED_COUNT_SQL} <= :usedStockMax`, { usedStockMax: filters.usedStockMax })
        }
        if (filters?.missingFields?.length) {
            const fieldMap: Record<string, string> = {
                image: "item.image IS NULL OR item.image = ''",
                description: "item.description IS NULL OR item.description = ''",
                subCategory: "item.subCategoryId IS NULL",
            }
            for (const field of filters.missingFields) {
                const condition = fieldMap[field]
                if (condition) idQuery.andWhere(`(${condition})`)
            }
        }
        if (filters?.labels?.length) {
            filters.labels.forEach((label, i) => {
                idQuery.andWhere(
                    `EXISTS (SELECT 1 FROM inventory_labels il${i} WHERE il${i}.inventory_id = item.id AND il${i}.key = :lk${i} AND il${i}.value LIKE :lv${i})`,
                    { [`lk${i}`]: label.key, [`lv${i}`]: `%${label.value}%` }
                )
            })
        }

        const total = await idQuery.getCount()

        const rawRows = await idQuery
            .orderBy(sortColumn, sortOrder)
            .offset((page - 1) * limit)
            .limit(limit)
            .getRawMany<{ id: number; variantCount: string | number; newCount: string | number; usedCount: string | number }>()

        const ids = rawRows.map((r) => Number(r.id))
        if (ids.length === 0) return { data: [], total }

        // 2) Load the full entities (with relations) and re-apply the page order.
        const items = await this.repository.find({ where: { id: In(ids) }, relations: RELATIONS })
        const byId = new Map(items.map((i) => [i.id, i]))
        const countById = new Map(rawRows.map((r) => [Number(r.id), { variantCount: Number(r.variantCount), newCount: Number(r.newCount), usedCount: Number(r.usedCount) }]))

        const data = ids
            .map((id) => byId.get(id))
            .filter((i): i is Inventory => !!i)
            .map((item) => {
                const c = countById.get(item.id)
                item.variantCount = c?.variantCount ?? 0
                item.newCount = c?.newCount ?? 0
                item.usedCount = c?.usedCount ?? 0
                return item
            })

        return { data, total }
    }

    async findList(): Promise<Inventory[]> {
        return await this.repository.find({ where: { isActive: true }, order: { name: "ASC" } })
    }

    async findById(id: number): Promise<Inventory | null> {
        return await this.repository.findOne({ where: { id }, relations: RELATIONS })
    }

    async countVariants(inventoryId: number): Promise<number> {
        return await AppDataSource.getRepository(InventoryVariant).count({ where: { inventoryId } })
    }

    async save(data: Partial<Inventory>, manager?: EntityManager): Promise<Inventory> {
        const repo = manager ? manager.getRepository(Inventory) : this.repository
        return await repo.save(data)
    }

    merge(entity: Inventory, data: Partial<Inventory>): Inventory {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }

    async saveLabel(data: Partial<InventoryLabel>, manager?: EntityManager): Promise<InventoryLabel> {
        const repo = manager ? manager.getRepository(InventoryLabel) : this.labelRepository
        return await repo.save(data)
    }

    async deleteLabels(inventoryId: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(InventoryLabel) : this.labelRepository
        await repo.delete({ inventoryId })
    }

    async findLabelKeys(): Promise<string[]> {
        const rows = await this.labelRepository.createQueryBuilder("label")
            .select("DISTINCT label.key", "key")
            .orderBy("label.key", "ASC")
            .getRawMany<{ key: string }>()
        return rows.map((r) => r.key)
    }
}
