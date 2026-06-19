import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetMaintenance } from "../entities/asset-maintenance.entity"
import { IAssetMaintenanceRepository } from "../interfaces/asset-maintenance.repository.interface"

export class TypeOrmAssetMaintenanceRepository implements IAssetMaintenanceRepository {
    private readonly repository: Repository<AssetMaintenance>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetMaintenance)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetMaintenance[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("maintenance")
            .leftJoinAndSelect("maintenance.asset", "asset")
            .leftJoinAndSelect("maintenance.createdBy", "createdBy")

        if (q) {
            query.where(
                "(maintenance.note LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("maintenance.assetId = :assetId", { assetId })
        }

        const total = await query.getCount()

        // Allowed sorting columns
        const sortColumnMap: Record<string, string> = {
            date: "maintenance.date",
            asset: "asset.name",
            note: "maintenance.note",
            createdBy: "createdBy.name",
            createdAt: "maintenance.createdAt",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "maintenance.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<AssetMaintenance | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["asset", "createdBy"],
        })
    }

    async save(data: Partial<AssetMaintenance>, manager?: EntityManager): Promise<AssetMaintenance> {
        const repo = manager ? manager.getRepository(AssetMaintenance) : this.repository
        return await repo.save(data)
    }

    merge(entity: AssetMaintenance, data: Partial<AssetMaintenance>): AssetMaintenance {
        return this.repository.merge(entity, data)
    }

    async delete(id: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(AssetMaintenance) : this.repository
        await repo.delete(id)
    }
}
