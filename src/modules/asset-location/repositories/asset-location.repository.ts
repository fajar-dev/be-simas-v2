import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetLocation } from "../entities/asset-location.entity"
import { IAssetLocationRepository } from "../interfaces/asset-location.repository.interface"

export class AssetLocationRepository implements IAssetLocationRepository {
    private readonly repository: Repository<AssetLocation>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetLocation)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetLocation[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("assetLocation")
            .leftJoinAndSelect("assetLocation.asset", "asset")
            .leftJoinAndSelect("assetLocation.location", "location")
            .leftJoinAndSelect("location.branch", "branch")
            .leftJoinAndSelect("assetLocation.createdBy", "createdBy")

        if (q) {
            query.where(
                "(assetLocation.note LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q OR location.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("assetLocation.assetId = :assetId", { assetId })
        }

        const total = await query.getCount()

        // Allowed sorting columns
        const sortColumnMap: Record<string, string> = {
            date: "assetLocation.date",
            location: "location.name",
            createdAt: "assetLocation.createdAt",
            note: "assetLocation.note",
            createdBy: "createdBy.name",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "assetLocation.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<AssetLocation | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["asset", "location", "location.branch", "createdBy"],
        })
    }

    async findLatestByAssetId(assetId: number): Promise<AssetLocation | null> {
        return await this.repository.findOne({
            where: { assetId },
            order: { id: "DESC" },
        })
    }

    async findLastLocation(assetId: number): Promise<AssetLocation | null> {
        return await this.repository.findOne({
            where: { assetId },
            order: { date: "DESC", id: "DESC" },
            relations: ["location", "location.branch"],
        })
    }

    async save(data: Partial<AssetLocation>, manager?: EntityManager): Promise<AssetLocation> {
        const repo = manager ? manager.getRepository(AssetLocation) : this.repository
        return await repo.save(data)
    }
}
