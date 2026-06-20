import { EntityManager, Repository, IsNull } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetHolder } from "../entities/asset-holder.entity"
import { IAssetHolderRepository } from "../interfaces/asset-holder.repository.interface"

export class AssetHolderRepository implements IAssetHolderRepository {
    private readonly repository: Repository<AssetHolder>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetHolder)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number,
        employeeId?: number
    ): Promise<{ data: AssetHolder[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("holder")
            .leftJoinAndSelect("holder.asset", "asset")
            .leftJoinAndSelect("holder.employee", "employee")
            .leftJoinAndSelect("holder.createdBy", "createdBy")
            .leftJoinAndSelect("holder.returnedBy", "returnedBy")

        if (q) {
            query.where(
                "(holder.assignNote LIKE :q OR holder.returnNote LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q OR employee.name LIKE :q OR employee.employeeId LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("holder.assetId = :assetId", { assetId })
        }

        if (employeeId) {
            query.andWhere("holder.employeeId = :employeeId", { employeeId })
        }

        const total = await query.getCount()

        // Allowed sorting columns
        const sortColumnMap: Record<string, string> = {
            assignedDate: "holder.assignedDate",
            returnedDate: "holder.returnedDate",
            employee: "employee.name",
            asset: "asset.name",
            notes: "holder.assignNote",
            createdBy: "createdBy.name",
            returnedBy: "returnedBy.name",
            createdAt: "holder.createdAt",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "holder.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<AssetHolder | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["asset", "employee", "createdBy", "returnedBy"],
        })
    }

    async findActiveByAssetId(assetId: number): Promise<AssetHolder | null> {
        return await this.repository.findOne({
            where: {
                assetId,
                returnedDate: IsNull(),
            },
            relations: ["asset", "employee", "createdBy", "returnedBy"],
        })
    }

    async save(data: Partial<AssetHolder>, manager?: EntityManager): Promise<AssetHolder> {
        const repo = manager ? manager.getRepository(AssetHolder) : this.repository
        return await repo.save(data)
    }
}
