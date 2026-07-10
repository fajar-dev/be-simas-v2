import { HandoverField } from "./entities/handover-field.entity"
import { IHandoverFieldRepository } from "./interfaces/handover-field.repository.interface"
import { ReplaceHandoverFieldsValidator } from "./validators/handover-field.validator"
import { BadRequestException } from "../../core/exceptions/base"
import { HandoverTransactionType } from "../../core/enums"

/** A snapshot of one custom field's definition + value, stored on a handover. */
export type HandoverFieldSnapshot = { key: string; label: string; type: string; value: string | null }

function slugify(label: string): string {
    return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field"
}

export class HandoverFieldService {
    constructor(private readonly repository: IHandoverFieldRepository) {}

    async getByType(transactionType: HandoverTransactionType): Promise<HandoverField[]> {
        return await this.repository.findByType(transactionType)
    }

    async replaceForType(transactionType: HandoverTransactionType, data: ReplaceHandoverFieldsValidator): Promise<HandoverField[]> {
        // Derive a unique machine key per field from its label.
        const seen = new Map<string, number>()
        const fields: Partial<HandoverField>[] = data.fields.map((f) => {
            const base = slugify(f.label)
            const n = seen.get(base) ?? 0
            seen.set(base, n + 1)
            const key = n === 0 ? base : `${base}_${n + 1}`
            const isChoice = f.type === "select" || f.type === "radio"
            return {
                label: f.label,
                key,
                type: f.type,
                options: isChoice ? (f.options ?? []) : null,
                required: !!f.required,
            }
        })
        return await this.repository.replaceForType(transactionType, fields)
    }

    /**
     * Resolve submitted values against the current field definitions for a type,
     * validating required fields, and return a self-contained snapshot to store
     * on the handover (so later definition edits don't affect it).
     */
    async resolveSnapshot(transactionType: HandoverTransactionType, values: Record<string, unknown> = {}): Promise<HandoverFieldSnapshot[]> {
        const defs = await this.repository.findByType(transactionType)
        const snapshot: HandoverFieldSnapshot[] = []
        for (const def of defs) {
            const raw = values[def.key]
            const value = raw === undefined || raw === null || raw === "" ? null : String(raw)
            if (def.required && value === null) {
                throw new BadRequestException(`Field "${def.label}" is required`)
            }
            if (value !== null && (def.type === "select" || def.type === "radio") && def.options && !def.options.includes(value)) {
                throw new BadRequestException(`Invalid value for field "${def.label}"`)
            }
            snapshot.push({ key: def.key, label: def.label, type: def.type, value })
        }
        return snapshot
    }
}
