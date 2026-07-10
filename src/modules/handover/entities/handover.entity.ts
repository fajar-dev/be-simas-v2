import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { Employee } from "../../employee/entities/employee.entity"
import { HandoverItem } from "./handover-item.entity"
import type { HandoverTransactionType, HandoverStatus } from "../../../core/enums"

@Entity("handovers")
export class Handover {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "received_by_id" })
    receivedById!: number

    @ManyToOne(() => Employee, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "received_by_id" })
    receivedBy!: Relation<Employee>

    @Index()
    @Column({ name: "handed_over_by_id", nullable: true })
    handedOverById?: number | null

    @ManyToOne(() => Employee, { onDelete: "RESTRICT", nullable: true })
    @JoinColumn({ name: "handed_over_by_id" })
    handedOverBy?: Relation<Employee> | null

    @Column({ name: "transaction_type", type: "varchar" })
    transactionType!: HandoverTransactionType

    @Column({ name: "note", type: "text", nullable: true })
    note?: string | null

    /**
     * Snapshot of the custom fields (definition + value) captured at creation time.
     * Self-contained so later edits to HandoverField definitions never affect this handover.
     */
    @Column({ name: "custom_fields", type: "simple-json", nullable: true })
    customFields?: { key: string; label: string; type: string; value: string | null }[] | null

    @Index()
    @Column({ type: "varchar", default: "pending" })
    status!: HandoverStatus

    // For a `return` handover: the origin `assign` handover it returns from
    // (best-effort — set only when all returned assets share one origin).
    @Index()
    @Column({ name: "parent_handover_id", nullable: true })
    parentHandoverId?: number | null

    @ManyToOne(() => Handover, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "parent_handover_id" })
    parentHandover?: Relation<Handover> | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @OneToMany(() => HandoverItem, (item) => item.handover)
    items?: Relation<HandoverItem[]>

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}