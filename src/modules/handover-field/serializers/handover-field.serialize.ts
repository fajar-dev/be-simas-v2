import { HandoverField } from "../entities/handover-field.entity"

export class HandoverFieldSerializer {
    static single(field: HandoverField) {
        return {
            id: field.id,
            transactionType: field.transactionType,
            label: field.label,
            key: field.key,
            type: field.type,
            options: field.options || null,
            required: field.required,
            sortOrder: field.sortOrder,
            createdAt: field.createdAt,
            updatedAt: field.updatedAt,
        }
    }

    static collection(fields: HandoverField[]) {
        return fields.map((f) => this.single(f))
    }
}
