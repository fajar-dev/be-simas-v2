import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { Handover } from "./handover.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { Branch } from "../../branch/entities/branch.entity"
import type { StockCondition } from "../../../core/enums"

/**
 * Stock line of a handover (kept separate from asset `handover_items`).
 * A handover is either asset-kind or stock-kind; stock lines carry the
 * variant, condition, source branch and quantity moved to/from an employee.
 */
@Entity("handover_stock_items")
export class HandoverStockItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "handover_id" })
    handoverId!: number

    @ManyToOne(() => Handover, (handover) => handover.stockItems, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "handover_id" })
    handover!: Relation<Handover>

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

    @Column({ type: "integer" })
    quantity!: number

    @Column({ type: "text", nullable: true })
    note?: string | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
