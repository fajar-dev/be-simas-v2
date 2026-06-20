import { EntityManager, Repository, In } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Attachment } from "../entities/attachment.entity"
import { IAttachmentRepository } from "../interfaces/attachment.repository.interface"

export class AttachmentRepository implements IAttachmentRepository {
    private readonly repository: Repository<Attachment>

    constructor() {
        this.repository = AppDataSource.getRepository(Attachment)
    }

    async findById(id: number): Promise<Attachment | null> {
        return await this.repository.findOneBy({ id })
    }

    async findManyByIds(ids: number[]): Promise<Attachment[]> {
        if (!ids || ids.length === 0) return []
        return await this.repository.findBy({ id: In(ids) })
    }

    async findByEntity(entityType: string, entityId: number): Promise<Attachment[]> {
        return await this.repository.findBy({ entityType, entityId })
    }

    async save(data: Partial<Attachment>, manager?: EntityManager): Promise<Attachment> {
        const repo = manager ? manager.getRepository(Attachment) : this.repository
        return await repo.save(data)
    }

    async delete(id: number, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(Attachment) : this.repository
        await repo.delete(id)
    }
}
