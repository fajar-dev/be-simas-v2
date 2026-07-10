import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from "typeorm"
import type { Relation } from "typeorm"
import { Branch } from "../../branch/entities/branch.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import type { StockCondition } from "../../../core/enums"

/** On-hand quantity per (branch, variant, condition). Source of truth for monitoring. */
@Entity("inventory_stock_balances")
@Unique(["branchId", "variantId", "condition"])
export class InventoryStockBalance {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "branch_id" })
    branchId!: number

    @ManyToOne(() => Branch, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "branch_id" })
    branch!: Relation<Branch>

    @Index()
    @Column({ name: "variant_id" })
    variantId!: number

    @ManyToOne(() => InventoryVariant, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "variant_id" })
    variant!: Relation<InventoryVariant>

    @Column({ type: "varchar" })
    condition!: StockCondition

    @Column({ type: "integer", default: 0 })
    quantity!: number

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
