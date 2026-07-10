import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { Branch } from "../../branch/entities/branch.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { User } from "../../user/entities/user.entity"
import type { StockCondition, StockMovementType } from "../../../core/enums"

/** Audit ledger: one row per stock change (entry/adjustment/transfer). */
@Entity("inventory_stock_movements")
export class InventoryStockMovement {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "variant_id" })
    variantId!: number

    @ManyToOne(() => InventoryVariant, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "variant_id" })
    variant!: Relation<InventoryVariant>

    @Index()
    @Column({ name: "branch_id" })
    branchId!: number

    @ManyToOne(() => Branch, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "branch_id" })
    branch!: Relation<Branch>

    @Column({ type: "varchar" })
    condition!: StockCondition

    @Column({ type: "varchar" })
    type!: StockMovementType

    /** Signed delta applied to the balance (positive in / negative out). */
    @Column({ type: "integer" })
    quantity!: number

    @Column({ name: "balance_after", type: "integer", nullable: true })
    balanceAfter?: number | null

    /** Groups related movements (e.g. both legs of a transfer). */
    @Index()
    @Column({ name: "reference_id", type: "varchar", nullable: true })
    referenceId?: string | null

    @Column({ type: "text", nullable: true })
    note?: string | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
