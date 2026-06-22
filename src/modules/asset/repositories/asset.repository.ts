import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Asset } from "../entities/asset.entity"
import { AssetLabel } from "../entities/asset-label.entity"
import { IAssetRepository, AssetFilter } from "../interfaces/asset.repository.interface"
import { AssetHolder } from "../../asset-holder/entities/asset-holder.entity"
import { AssetLocation } from "../../asset-location/entities/asset-location.entity"
import { Employee } from "../../employee/entities/employee.entity"
import { Location } from "../../location/entities/location.entity"

export class AssetRepository implements IAssetRepository {
    private readonly repository: Repository<Asset>

    constructor() {
        this.repository = AppDataSource.getRepository(Asset)
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: AssetFilter): Promise<{ data: Asset[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("asset")
            .leftJoinAndSelect("asset.subCategory", "subCategory")
            .leftJoinAndSelect("subCategory.category", "category")
            .leftJoinAndSelect("asset.labels", "labels")
            .leftJoinAndSelect("asset.createdBy", "createdBy")
            .leftJoin(AssetHolder, "activeHolder", "activeHolder.assetId = asset.id AND activeHolder.returnedDate IS NULL")
            .leftJoin(Employee, "activeEmployee", "activeEmployee.id = activeHolder.employeeId")
            .leftJoin(AssetLocation, "lastAssetLocation", "lastAssetLocation.id = (SELECT MAX(sub_al.id) FROM asset_locations sub_al WHERE sub_al.asset_id = asset.id)")
            .leftJoin(Location, "lastLoc", "lastLoc.id = lastAssetLocation.locationId")
            .addSelect("activeEmployee.name")
            .addSelect("lastLoc.name")

        if (q) {
            query.where(
                "(asset.name LIKE :q OR asset.code LIKE :q OR asset.brand LIKE :q OR asset.model LIKE :q OR subCategory.name LIKE :q OR category.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (filters?.categoryIds?.length) {
            query.andWhere("subCategory.categoryId IN (:...categoryIds)", { categoryIds: filters.categoryIds })
        }
        if (filters?.subCategoryIds?.length) {
            query.andWhere("asset.subCategoryId IN (:...subCategoryIds)", { subCategoryIds: filters.subCategoryIds })
        }
        if (filters?.branchIds?.length) {
            query.andWhere("lastLoc.branchId IN (:...branchIds)", { branchIds: filters.branchIds })
        }
        if (filters?.locationIds?.length) {
            query.andWhere("lastAssetLocation.locationId IN (:...locationIds)", { locationIds: filters.locationIds })
        }
        if (filters?.status?.length) {
            query.andWhere(
                `(SELECT s.status FROM asset_statuses s WHERE s.asset_id = asset.id ORDER BY s.id DESC LIMIT 1) IN (:...statuses)`,
                { statuses: filters.status }
            )
        }
        if (filters?.holderStatus === 'has_holder') {
            query.andWhere("activeHolder.id IS NOT NULL")
        }
        if (filters?.holderStatus === 'no_holder') {
            query.andWhere("activeHolder.id IS NULL")
        }
        if (filters?.holderId) {
            query.andWhere("activeHolder.employeeId = :holderId", { holderId: filters.holderId })
        }
        if (filters?.priceMin !== undefined) {
            query.andWhere("asset.price >= :priceMin", { priceMin: filters.priceMin })
        }
        if (filters?.priceMax !== undefined) {
            query.andWhere("asset.price <= :priceMax", { priceMax: filters.priceMax })
        }
        if (filters?.purchaseDateFrom) {
            query.andWhere("asset.purchaseDate >= :purchaseDateFrom", { purchaseDateFrom: filters.purchaseDateFrom })
        }
        if (filters?.purchaseDateTo) {
            query.andWhere("asset.purchaseDate <= :purchaseDateTo", { purchaseDateTo: filters.purchaseDateTo })
        }
        if (filters?.labels?.length) {
            filters.labels.forEach((label, i) => {
                query.andWhere(
                    `EXISTS (SELECT 1 FROM asset_labels al${i} WHERE al${i}.asset_id = asset.id AND al${i}.key = :lk${i} AND al${i}.value LIKE :lv${i})`,
                    { [`lk${i}`]: label.key, [`lv${i}`]: `%${label.value}%` }
                )
            })
        }
        if (filters?.missingFields?.length) {
            const fieldMap: Record<string, string> = {
                image: "asset.image IS NULL OR asset.image = ''",
                price: "asset.price IS NULL OR asset.price = 0",
                brand: "asset.brand IS NULL OR asset.brand = ''",
                model: "asset.model IS NULL OR asset.model = ''",
                purchaseDate: "asset.purchase_date IS NULL OR asset.purchase_date = ''",
            }
            for (const field of filters.missingFields) {
                const condition = fieldMap[field]
                if (condition) {
                    query.andWhere(`(${condition})`)
                }
            }
        }

        const total = await query.getCount()

        // Whitelist of allowed sort columns
        const sortColumnMap: Record<string, string> = {
            name: "asset.name",
            code: "asset.code",
            brand: "asset.brand",
            model: "asset.model",
            price: "asset.price",
            purchaseDate: "asset.purchaseDate",
            createdAt: "asset.createdAt",
            category: "category.name",
            subCategory: "subCategory.name",
            location: "lastLoc.name",
            holder: "activeEmployee.name",
            lastLocation: "lastLoc.name",
            activeHolder: "activeEmployee.name",
        }

        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'
        if (sortBy && sortBy.startsWith("label:")) {
            const labelKey = sortBy.substring(6)
            query.leftJoin(AssetLabel, "sortByLabel", "sortByLabel.assetId = asset.id AND sortByLabel.key = :sortByLabelKey", { sortByLabelKey: labelKey })
            query.addSelect("sortByLabel.value")
            query.orderBy("sortByLabel.value", sortOrder)
        } else {
            const sortColumn = sortColumnMap[sortBy || ''] || "asset.id"
            query.orderBy(sortColumn, sortOrder)
        }

        const data = await query
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<Asset | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["subCategory", "subCategory.category", "labels", "createdBy"]
        })
    }

    async findByCode(code: string): Promise<Asset | null> {
        return await this.repository.findOne({ where: { code } })
    }

    async save(data: Partial<Asset>, manager?: EntityManager): Promise<Asset> {
        const repo = manager ? manager.getRepository(Asset) : this.repository
        return await repo.save(data)
    }

    merge(entity: Asset, data: Partial<Asset>): Asset {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }

    async deleteLabels(assetId: number): Promise<void> {
        await AppDataSource.getRepository(AssetLabel).delete({ assetId })
    }

    async saveLabels(assetId: number, labels: { key: string; value: string }[]): Promise<void> {
        const repo = AppDataSource.getRepository(AssetLabel)
        const entities = labels.map(l => repo.create({ key: l.key, value: l.value, assetId }))
        await repo.save(entities)
    }

    async getUniqueLabelKeys(): Promise<string[]> {
        const result = await AppDataSource.getRepository(AssetLabel).createQueryBuilder("label")
            .select("DISTINCT label.key", "key")
            .where("label.key IS NOT NULL AND label.key != ''")
            .orderBy("label.key", "ASC")
            .getRawMany()
        return result.map(r => r.key)
    }
}
