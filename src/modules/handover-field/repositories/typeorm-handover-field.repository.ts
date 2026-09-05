import { Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { HandoverField } from "../entities/handover-field.entity"
import { IHandoverFieldRepository } from "../interfaces/handover-field.repository.interface"
import { withTransaction } from "../../../core/helpers/transaction"
import { HandoverTransactionType } from "../../../core/enums"

export class TypeOrmHandoverFieldRepository implements IHandoverFieldRepository {
    private readonly repository: Repository<HandoverField>

    constructor() {
        this.repository = AppDataSource.getRepository(HandoverField)
    }

    async findByType(transactionType: HandoverTransactionType): Promise<HandoverField[]> {
        return await this.repository.find({
            where: { transactionType },
            order: { sortOrder: "ASC", id: "ASC" },
        })
    }

    async replaceForType(transactionType: HandoverTransactionType, fields: Partial<HandoverField>[]): Promise<HandoverField[]> {
        return await withTransaction(async (manager) => {
            const repo = manager.getRepository(HandoverField)
            await repo.delete({ transactionType })
            if (fields.length === 0) return []
            const entities = fields.map((f, i) => repo.create({ ...f, transactionType, sortOrder: i }))
            return await repo.save(entities)
        })
    }
}
