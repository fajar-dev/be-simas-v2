import { EntityManager, Repository, IsNull } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetHolder } from "../entities/asset-holder.entity"
import { Asset } from "../../asset/entities/asset.entity"
import { HandoverItem } from "../../handover/entities/handover-item.entity"
import { AssetStatus } from "../../asset-status/entities/asset-status.entity"
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
        employeeId?: number,
        organizationId?: number
    ): Promise<{ data: AssetHolder[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("holder")
            .leftJoinAndSelect("holder.asset", "asset")
            .leftJoinAndSelect("holder.employee", "employee")
            .leftJoinAndSelect("holder.organization", "organization")
            .leftJoinAndSelect("holder.createdBy", "createdBy")
            .leftJoinAndSelect("holder.returnedBy", "returnedBy")
            .leftJoinAndSelect("holder.assignHandover", "assignHandover")
            .leftJoinAndSelect("holder.returnHandover", "returnHandover")

        if (q) {
            query.where(
                "(holder.assignNote LIKE :q OR holder.returnNote LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q OR employee.name LIKE :q OR employee.employeeId LIKE :q OR organization.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("holder.assetId = :assetId", { assetId })
        }

        if (employeeId) {
            query.andWhere("holder.employeeId = :employeeId", { employeeId })
        }

        if (organizationId) {
            query.andWhere("holder.organizationId = :organizationId", { organizationId })
        }

        const total = await query.getCount()

        const sortColumnMap: Record<string, string> = {
            assignedDate: "holder.assignedDate",
            returnedDate: "holder.returnedDate",
            employee: "employee.name",
            organization: "organization.name",
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
            relations: ["asset", "employee", "organization", "createdBy", "returnedBy", "assignHandover", "returnHandover"],
        })
    }

    async findActiveByAssetId(assetId: number): Promise<AssetHolder | null> {
        return await this.repository.findOne({
            where: {
                assetId,
                returnedDate: IsNull(),
            },
            relations: ["asset", "employee", "organization", "createdBy", "returnedBy", "assignHandover", "returnHandover"],
        })
    }

    async findActiveByHandoverId(handoverId: number): Promise<AssetHolder[]> {
        return await this.repository.find({
            where: {
                assignHandoverId: handoverId,
                returnedDate: IsNull(),
            },
            relations: ["asset", "employee", "organization", "createdBy", "returnedBy", "assignHandover", "returnHandover"],
        })
    }

    async findEmployeeHeldByAssetId(assetId: number): Promise<AssetHolder[]> {
        return await this.repository.find({
            where: { assetId, holderKind: "employee" },
            relations: ["asset", "employee"],
        })
    }

    async save(data: Partial<AssetHolder>, manager?: EntityManager): Promise<AssetHolder> {
        const repo = manager ? manager.getRepository(AssetHolder) : this.repository
        return await repo.save(data)
    }

    merge(entity: AssetHolder, data: Partial<AssetHolder>): AssetHolder {
        return this.repository.merge(entity, data)
    }

    async delete(id: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(AssetHolder) : this.repository
        await repo.delete(id)
    }

    async assetExists(assetId: number): Promise<boolean> {
        const count = await AppDataSource.getRepository(Asset).count({ where: { id: assetId } })
        return count > 0
    }

    async findPendingHandoverAssetIds(): Promise<number[]> {
        const pendingItems = await AppDataSource.getRepository(HandoverItem)
            .createQueryBuilder("item")
            .innerJoin("item.handover", "handover")
            .where("handover.status = :status", { status: "pending" })
            .select("item.assetId", "assetId")
            .getRawMany()
        return pendingItems.map(item => item.assetId)
    }

    async findLastAssetStatus(assetId: number): Promise<string | null> {
        const status = await AppDataSource.getRepository(AssetStatus).findOne({
            where: { assetId },
            order: { id: "DESC" },
        })
        return status?.status ?? null
    }
}
