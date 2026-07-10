import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from "typeorm"
import type { HandoverTransactionType, HandoverFieldType } from "../../../core/enums"

/**
 * A configurable custom field shown on the handover create form for a given
 * transaction type. Each handover snapshots the resolved field values at
 * creation time, so editing these definitions never affects existing handovers.
 */
@Entity("handover_fields")
export class HandoverField {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "transaction_type", type: "varchar" })
    transactionType!: HandoverTransactionType

    @Column({ type: "varchar" })
    label!: string

    @Column({ type: "varchar" })
    key!: string

    @Column({ type: "varchar" })
    type!: HandoverFieldType

    /** Options for `select` / `radio` types; null otherwise. */
    @Column({ type: "simple-json", nullable: true })
    options?: string[] | null

    @Column({ type: "boolean", default: false })
    required!: boolean

    @Column({ name: "sort_order", type: "integer", default: 0 })
    sortOrder!: number

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
