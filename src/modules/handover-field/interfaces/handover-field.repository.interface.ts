import { HandoverField } from "../entities/handover-field.entity"
import { HandoverTransactionType } from "../../../core/enums"

export interface IHandoverFieldRepository {
    findByType(transactionType: HandoverTransactionType): Promise<HandoverField[]>
    /** Replace the whole field set for a transaction type atomically. */
    replaceForType(transactionType: HandoverTransactionType, fields: Partial<HandoverField>[]): Promise<HandoverField[]>
}
