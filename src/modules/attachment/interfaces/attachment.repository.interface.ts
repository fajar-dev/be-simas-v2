import { Attachment } from "../entities/attachment.entity"
import { EntityManager } from "typeorm"

export interface IAttachmentRepository {
    save(data: Partial<Attachment>, manager?: EntityManager): Promise<Attachment>
    findById(id: number): Promise<Attachment | null>
    findManyByIds(ids: number[]): Promise<Attachment[]>
    findByEntity(entityType: string, entityId: number): Promise<Attachment[]>
    delete(id: number, manager?: EntityManager): Promise<void>
}
