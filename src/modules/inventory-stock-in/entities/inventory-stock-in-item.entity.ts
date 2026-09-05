import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { InventoryStockIn } from "./inventory-stock-in.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { Branch } from "../../branch/entities/branch.entity"
import type { StockCondition } from "../../../core/enums"

/** One line of a stock-in document (a single variant/branch/condition increment). */
@Entity("inventory_stock_in_items")
export class InventoryStockInItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "stock_in_id" })
    stockInId!: number

    @ManyToOne(() => InventoryStockIn, (stockIn) => stockIn.items, { onDelete: "CASCADE" })
    @JoinColumn({ name: "stock_in_id" })
    stockIn!: Relation<InventoryStockIn>

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

    /** Signed delta applied to the balance (positive in). */
    @Column({ type: "integer" })
    quantity!: number

    @Column({ name: "balance_after", type: "integer", nullable: true })
    balanceAfter?: number | null
}
