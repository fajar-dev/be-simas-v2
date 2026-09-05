import { Brackets, EntityManager, In, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetSchedule } from "../entities/asset-schedule.entity"
import { AssetScheduleAsset } from "../entities/asset-schedule-asset.entity"
import { AssetScheduleUser } from "../entities/asset-schedule-user.entity"
import { IAssetScheduleRepository, AssetScheduleFilter } from "../interfaces/asset-schedule.repository.interface"

const SORTABLE = new Set(["title", "startDate", "recurrence", "createdAt"])

export class TypeOrmAssetScheduleRepository implements IAssetScheduleRepository {
    private readonly repository: Repository<AssetSchedule>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetSchedule)
    }

    private withRelations() {
        return this.repository
            .createQueryBuilder("schedule")
            .leftJoinAndSelect("schedule.scheduleAssets", "link")
            .leftJoinAndSelect("link.asset", "asset")
            .leftJoinAndSelect("schedule.scheduleUsers", "userLink")
            .leftJoinAndSelect("userLink.user", "assignedUser")
            .leftJoinAndSelect("schedule.createdBy", "createdBy")
    }

    private applyFilters(query: { andWhere: Function }, filters?: AssetScheduleFilter) {
        if (filters?.assetId) {
            query.andWhere(
                "schedule.id IN (SELECT asa.schedule_id FROM asset_schedule_assets asa WHERE asa.asset_id = :assetId)",
                { assetId: filters.assetId }
            )
        }
        if (filters?.recurrence) {
            query.andWhere("schedule.recurrence = :recurrence", { recurrence: filters.recurrence })
        }
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order: "ASC" | "DESC" = "DESC",
        filters?: AssetScheduleFilter
    ): Promise<{ data: AssetSchedule[]; total: number }> {
        const offset = (page - 1) * limit
        const sortColumn = sortBy && SORTABLE.has(sortBy) ? sortBy : "startDate"

        // Step 1 — paginate schedule ids only (avoids row multiplication from the asset join).
        const idQuery = this.repository.createQueryBuilder("schedule")
        if (q) {
            idQuery.andWhere(
                new Brackets((qb) => {
                    qb.where("schedule.title LIKE :q", { q: `%${q}%` }).orWhere(
                        "schedule.id IN (SELECT asa.schedule_id FROM asset_schedule_assets asa JOIN assets a ON a.id = asa.asset_id WHERE a.name LIKE :q OR a.code LIKE :q)",
                        { q: `%${q}%` }
                    )
                })
            )
        }
        this.applyFilters(idQuery, filters)

        const total = await idQuery.getCount()
        const idRows = await idQuery
            .select("schedule.id", "id")
            .orderBy(`schedule.${sortColumn}`, order)
            .addOrderBy("schedule.id", "DESC")
            .offset(offset)
            .limit(limit)
            .getRawMany<{ id: number }>()

        const ids = idRows.map((r) => r.id)
        if (ids.length === 0) return { data: [], total }

        // Step 2 — load the full rows (with relations) for just those ids, preserving order.
        const rows = await this.withRelations().where("schedule.id IN (:...ids)", { ids }).getMany()
        const byId = new Map(rows.map((r) => [r.id, r]))
        const data = ids.map((id) => byId.get(id)!).filter(Boolean)
        return { data, total }
    }

    async findForRange(from: string, to: string, filters?: AssetScheduleFilter): Promise<AssetSchedule[]> {
        const query = this.withRelations()
            .where("schedule.start_date <= :to", { to })
            .andWhere(
                new Brackets((qb) => {
                    qb.where(
                        new Brackets((inner) => {
                            inner.where("schedule.recurrence = :none", { none: "none" }).andWhere("schedule.start_date >= :from", { from })
                        })
                    ).orWhere(
                        new Brackets((inner) => {
                            inner.where("schedule.recurrence != :none", { none: "none" }).andWhere(
                                new Brackets((end) => {
                                    end.where("schedule.recurrence_end_date IS NULL").orWhere("schedule.recurrence_end_date >= :from", { from })
                                })
                            )
                        })
                    )
                })
            )

        this.applyFilters(query, filters)

        return await query.orderBy("schedule.start_date", "ASC").getMany()
    }

    async findById(id: number): Promise<AssetSchedule | null> {
        return await this.withRelations().where("schedule.id = :id", { id }).getOne()
    }

    async save(data: Partial<AssetSchedule>, manager?: EntityManager): Promise<AssetSchedule> {
        const repo = manager ? manager.getRepository(AssetSchedule) : this.repository
        return await repo.save(data)
    }

    merge(entity: AssetSchedule, data: Partial<AssetSchedule>): AssetSchedule {
        return this.repository.merge(entity, data)
    }

    async setAssets(scheduleId: number, assetIds: number[], manager?: EntityManager): Promise<void> {
        const linkRepo = manager ? manager.getRepository(AssetScheduleAsset) : AppDataSource.getRepository(AssetScheduleAsset)
        const existing = await linkRepo.find({ where: { scheduleId } })
        const existingIds = new Set(existing.map((l) => l.assetId))
        const wanted = new Set(assetIds)

        const toRemove = existing.filter((l) => !wanted.has(l.assetId)).map((l) => l.id)
        if (toRemove.length) await linkRepo.delete({ id: In(toRemove) })

        const toAdd = assetIds.filter((id) => !existingIds.has(id))
        if (toAdd.length) await linkRepo.save(toAdd.map((assetId) => linkRepo.create({ scheduleId, assetId })))
    }

    async setUsers(scheduleId: number, userIds: number[], manager?: EntityManager): Promise<void> {
        const linkRepo = manager ? manager.getRepository(AssetScheduleUser) : AppDataSource.getRepository(AssetScheduleUser)
        const existing = await linkRepo.find({ where: { scheduleId } })
        const existingIds = new Set(existing.map((l) => l.userId))
        const wanted = new Set(userIds)

        const toRemove = existing.filter((l) => !wanted.has(l.userId)).map((l) => l.id)
        if (toRemove.length) await linkRepo.delete({ id: In(toRemove) })

        const toAdd = userIds.filter((id) => !existingIds.has(id))
        if (toAdd.length) await linkRepo.save(toAdd.map((userId) => linkRepo.create({ scheduleId, userId })))
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
