import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetStatus } from "../entities/asset-status.entity"
import { IAssetStatusRepository } from "../interfaces/asset-status.repository.interface"

export class AssetStatusRepository implements IAssetStatusRepository {
    private readonly repository: Repository<AssetStatus>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetStatus)
    }

    async findByAssetId(assetId: number, page: number, limit: number): Promise<{ data: AssetStatus[]; total: number }> {
        const offset = (page - 1) * limit

        const [data, total] = await this.repository.findAndCount({
            where: { assetId },
            relations: ["createdBy"],
            order: { id: "DESC" },
            skip: offset,
            take: limit,
        })

        return { data, total }
    }

    async findLastByAssetId(assetId: number): Promise<AssetStatus | null> {
        return await this.repository.findOne({
            where: { assetId },
            relations: ["createdBy"],
            order: { id: "DESC" },
        })
    }

    async save(data: Partial<AssetStatus>, manager?: EntityManager): Promise<AssetStatus> {
        const repo = manager ? manager.getRepository(AssetStatus) : this.repository
        return await repo.save(data)
    }
}
