import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetNote } from "../entities/asset-note.entity"
import { AssetLabel } from "../../asset/entities/asset-label.entity"
import { IAssetNoteRepository } from "../interfaces/asset-note.repository.interface"

export class AssetNoteRepository implements IAssetNoteRepository {
    private readonly repository: Repository<AssetNote>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetNote)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetNote[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("note")
            .leftJoinAndSelect("note.asset", "asset")
            .leftJoinAndSelect("note.createdBy", "createdBy")
            .leftJoin("asset_labels", "label", "label.entityType = :labelType AND label.entityId = note.id", { labelType: "AssetNote" })

        if (q) {
            query.where(
                "(note.note LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q OR label.key LIKE :q OR label.value LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("note.assetId = :assetId", { assetId })
        }

        query.distinct(true)
        const total = await query.getCount()

        // Allowed sorting columns
        const sortColumnMap: Record<string, string> = {
            date: "note.date",
            asset: "asset.name",
            note: "note.note",
            createdBy: "createdBy.name",
            createdAt: "note.createdAt",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "note.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<AssetNote | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["asset", "createdBy"],
        })
    }

    async save(data: Partial<AssetNote>, manager?: EntityManager): Promise<AssetNote> {
        const repo = manager ? manager.getRepository(AssetNote) : this.repository
        return await repo.save(data)
    }

    merge(entity: AssetNote, data: Partial<AssetNote>): AssetNote {
        return this.repository.merge(entity, data)
    }

    async delete(id: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(AssetNote) : this.repository
        await repo.delete(id)
    }

    async deleteLabels(entityType: string, entityId: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(AssetLabel) : AppDataSource.getRepository(AssetLabel)
        await repo.delete({ entityType, entityId })
    }

    async saveLabels(entityType: string, entityId: number, labels: { key: string; value: string }[], manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(AssetLabel) : AppDataSource.getRepository(AssetLabel)
        const entities = labels.map(l => repo.create({ key: l.key, value: l.value, entityType, entityId }))
        await repo.save(entities)
    }

    async getLabelsForEntity(entityType: string, entityId: number): Promise<AssetLabel[]> {
        return await AppDataSource.getRepository(AssetLabel).find({ where: { entityType, entityId } })
    }

    async getLabelsForEntities(entityType: string, entityIds: number[]): Promise<Map<number, AssetLabel[]>> {
        if (entityIds.length === 0) return new Map()
        const labels = await AppDataSource.getRepository(AssetLabel)
            .createQueryBuilder("label")
            .where("label.entityType = :entityType AND label.entityId IN (:...entityIds)", { entityType, entityIds })
            .getMany()
        const map = new Map<number, AssetLabel[]>()
        for (const label of labels) {
            const arr = map.get(label.entityId) || []
            arr.push(label)
            map.set(label.entityId, arr)
        }
        return map
    }

    async getUniqueLabelKeys(entityType: string, assetId?: number): Promise<string[]> {
        const qb = AppDataSource.getRepository(AssetLabel).createQueryBuilder("label")
            .select("DISTINCT label.key", "key")
            .where("label.entityType = :entityType AND label.key IS NOT NULL AND label.key != ''", { entityType })

        if (assetId) {
            qb.innerJoin("asset_notes", "n", "n.id = label.entityId")
              .andWhere("n.assetId = :assetId", { assetId })
        }

        const result = await qb.orderBy("label.key", "ASC").getRawMany()
        return result.map(r => r.key)
    }
}
