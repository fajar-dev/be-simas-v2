import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetHandover } from "../entities/asset-handover.entity"
import { AssetHandoverItem } from "../entities/asset-handover-item.entity"
import { IAssetHandoverRepository, AssetHandoverFilter } from "../interfaces/asset-handover.repository.interface"

export class TypeOrmAssetHandoverRepository implements IAssetHandoverRepository {
    private readonly repository: Repository<AssetHandover>
    private readonly itemRepository: Repository<AssetHandoverItem>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetHandover)
        this.itemRepository = AppDataSource.getRepository(AssetHandoverItem)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        filters?: AssetHandoverFilter
    ): Promise<{ data: AssetHandover[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("handover")
            .leftJoinAndSelect("handover.items", "items")
            .leftJoinAndSelect("items.asset", "asset")
            .leftJoinAndSelect("handover.receivedBy", "receivedBy")
            .leftJoinAndSelect("handover.handedOverBy", "handedOverBy")
            .leftJoinAndSelect("handover.createdBy", "createdBy")

        if (q) {
            query.where(
                "(handover.note LIKE :q OR handover.purpose LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q OR receivedBy.name LIKE :q OR handedOverBy.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (filters?.status) {
            query.andWhere("handover.status = :status", { status: filters.status })
        }

        if (filters?.transactionType) {
            query.andWhere("handover.transactionType = :transactionType", { transactionType: filters.transactionType })
        }

        const total = await query.getCount()

        const sortColumnMap: Record<string, string> = {
            date: "handover.date",
            status: "handover.status",
            transactionType: "handover.transactionType",
            createdAt: "handover.createdAt",
        }
        const sortColumn = sortColumnMap[sortBy || ''] || "handover.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<AssetHandover | null> {
        return await this.repository.findOne({
            where: { id },
            relations: [
                "items",
                "items.asset",
                "receivedBy",
                "handedOverBy",
                "createdBy",
            ],
        })
    }

    async findPendingItemAssetIds(excludeHandoverId?: number): Promise<number[]> {
        const query = this.itemRepository.createQueryBuilder("item")
            .innerJoin("item.handover", "handover")
            .where("handover.status = :status", { status: "pending" })
            .select("item.assetId", "assetId")

        if (excludeHandoverId) {
            query.andWhere("handover.id != :excludeHandoverId", { excludeHandoverId })
        }

        const rows = await query.getRawMany<{ assetId: number }>()
        return rows.map((r) => Number(r.assetId))
    }

    async save(data: Partial<AssetHandover>, manager?: EntityManager): Promise<AssetHandover> {
        const repo = manager ? manager.getRepository(AssetHandover) : this.repository
        return await repo.save(data)
    }

    async saveItem(data: Partial<AssetHandoverItem>, manager?: EntityManager): Promise<AssetHandoverItem> {
        const repo = manager ? manager.getRepository(AssetHandoverItem) : this.itemRepository
        return await repo.save(data)
    }

    async deleteItems(handoverId: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(AssetHandoverItem) : this.itemRepository
        await repo.delete({ handoverId })
    }

    async delete(id: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(AssetHandover) : this.repository
        await repo.delete(id)
    }

    merge(entity: AssetHandover, data: Partial<AssetHandover>): AssetHandover {
        return this.repository.merge(entity, data)
    }
}
