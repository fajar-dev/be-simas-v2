import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetNote } from "../entities/asset-note.entity"
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

        if (q) {
            query.where(
                "(note.note LIKE :q OR asset.name LIKE :q OR asset.code LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (assetId) {
            query.andWhere("note.assetId = :assetId", { assetId })
        }

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
}
