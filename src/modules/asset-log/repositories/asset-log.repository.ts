import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetLog } from "../entities/asset-log.entity"
import { IAssetLogRepository } from "../interfaces/asset-log.repository.interface"

export class AssetLogRepository implements IAssetLogRepository {
    private readonly repository: Repository<AssetLog>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetLog)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetLog[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("log")
            .leftJoinAndSelect("log.createdBy", "createdBy")

        if (q) {
            query.where(
                "(log.description LIKE :q OR log.module LIKE :q OR log.action LIKE :q OR createdBy.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("log.assetId = :assetId", { assetId })
        }

        const total = await query.getCount()

        // Allowed sorting columns
        const sortColumnMap: Record<string, string> = {
            module: "log.module",
            action: "log.action",
            description: "log.description",
            createdBy: "createdBy.name",
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

    async findById(id: number): Promise<AssetLog | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["createdBy"],
        })
    }

    async save(data: Partial<AssetLog>, manager?: EntityManager): Promise<AssetLog> {
        const repo = manager ? manager.getRepository(AssetLog) : this.repository
        return await repo.save(data)
    }
}
