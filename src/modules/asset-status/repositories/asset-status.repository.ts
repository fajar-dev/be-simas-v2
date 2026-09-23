import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetStatus } from "../entities/asset-status.entity"
import { Asset } from "../../asset/entities/asset.entity"
import { HandoverItem } from "../../handover/entities/handover-item.entity"
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

    async findAsset(assetId: number): Promise<Pick<Asset, 'id' | 'name'> | null> {
        return await AppDataSource.getRepository(Asset).findOne({ where: { id: assetId }, select: ['id', 'name'] })
    }

    async countPendingHandoverItems(assetId: number): Promise<number> {
        return await AppDataSource.getRepository(HandoverItem)
            .createQueryBuilder("item")
            .innerJoin("item.handover", "handover")
            .where("item.assetId = :assetId", { assetId })
            .andWhere("handover.status = :status", { status: "pending" })
            .getCount()
    }
}
