import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetLocation } from "../entities/asset-location.entity"
import { IAssetLocationRepository } from "../interfaces/asset-location.repository.interface"

export class TypeOrmAssetLocationRepository implements IAssetLocationRepository {
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

        const query = this.repository.createQueryBuilder("log")
            .leftJoinAndSelect("log.asset", "asset")
            .leftJoinAndSelect("log.location", "location")
            .leftJoinAndSelect("log.createdBy", "createdBy")

        if (q) {
            query.where(
                "(log.note LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q OR location.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("log.assetId = :assetId", { assetId })
        }

        const total = await query.getCount()

        // Allowed sorting columns
        const sortColumnMap: Record<string, string> = {
            date: "log.date",
            location: "location.name",
            createdAt: "log.createdAt",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "log.id"
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
            relations: ["asset", "location", "createdBy"],
        })
    }

    async save(data: Partial<AssetLocation>, manager?: EntityManager): Promise<AssetLocation> {
        const repo = manager ? manager.getRepository(AssetLocation) : this.repository
        return await repo.save(data)
    }
}
