import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Asset } from "../entities/asset.entity"
import { AssetLabel } from "../entities/asset-label.entity"
import { IAssetRepository } from "../interfaces/asset.repository.interface"
import { AssetHolder } from "../../asset-holder/entities/asset-holder.entity"
import { AssetLocation } from "../../asset-location/entities/asset-location.entity"
import { Employee } from "../../employee/entities/employee.entity"
import { Location } from "../../location/entities/location.entity"

export class TypeOrmAssetRepository implements IAssetRepository {
    private readonly repository: Repository<Asset>

    constructor() {
        this.repository = AppDataSource.getRepository(Asset)
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Asset[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("asset")
            .leftJoinAndSelect("asset.subCategory", "subCategory")
            .leftJoinAndSelect("subCategory.category", "category")
            .leftJoinAndSelect("asset.labels", "labels")
            .leftJoin(AssetHolder, "activeHolder", "activeHolder.assetId = asset.id AND activeHolder.returnedDate IS NULL")
            .leftJoin(Employee, "activeEmployee", "activeEmployee.id = activeHolder.employeeId")
            .leftJoin(AssetLocation, "lastAssetLocation", "lastAssetLocation.id = (SELECT MAX(sub_al.id) FROM asset_locations sub_al WHERE sub_al.asset_id = asset.id)")
            .leftJoin(Location, "lastLoc", "lastLoc.id = lastAssetLocation.locationId")

        if (q) {
            query.where(
                "(asset.name LIKE :q OR asset.code LIKE :q OR asset.brand LIKE :q OR asset.model LIKE :q OR subCategory.name LIKE :q OR category.name LIKE :q)",
                { q: `%${q}%` }
            )
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

        const sortColumn = sortColumnMap[sortBy || ''] || "asset.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<Asset | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["subCategory", "subCategory.category", "labels"]
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
}
