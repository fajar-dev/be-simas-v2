import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { Employee } from "../../employee/entities/employee.entity"
import { AssetHandoverItem } from "./asset-handover-item.entity"

export type HandoverTransactionType = "serah_terima" | "peminjaman" | "pengembalian"
export type HandoverCategory = "inventaris_kantor" | "aset_program_cicilan"
export type HandoverStatus = "pending" | "approve" | "reject"

@Entity("asset_handovers")
export class AssetHandover {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "received_by_id" })
    receivedById!: number

    @ManyToOne(() => Employee, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "received_by_id" })
    receivedBy!: Employee

    @Index()
    @Column({ name: "handed_over_by_id", nullable: true })
    handedOverById?: number | null

    @ManyToOne(() => Employee, { onDelete: "RESTRICT", nullable: true })
    @JoinColumn({ name: "handed_over_by_id" })
    handedOverBy?: Employee | null

    @Column({ name: "transaction_type", type: "varchar" })
    transactionType!: HandoverTransactionType

    @Column({ name: "category", type: "varchar" })
    category!: HandoverCategory

    @Column({ type: "text", nullable: true })
    purpose?: string | null

    @Column({ name: "estimated_return_date", type: "varchar", nullable: true })
    estimatedReturnDate?: string | null

    @Index()
    @Column({ type: "varchar", default: "pending" })
    status!: HandoverStatus

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @OneToMany(() => AssetHandoverItem, (item) => item.handover)
    items?: AssetHandoverItem[]

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
