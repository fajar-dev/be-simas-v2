import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { InventoryStockOut } from "./inventory-stock-out.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { Branch } from "../../branch/entities/branch.entity"
import { Handover } from "../../handover/entities/handover.entity"
import { User } from "../../user/entities/user.entity"
import type { StockCondition } from "../../../core/enums"

/**
 * One line of a stock-out document (a single variant/branch/condition taken
 * out) — partially returnable: remaining = `quantity - quantityReturned`,
 * fully returned once `returnedDate` is set. Lines under an `isEmployee: false`
 * document are marked fully resolved at creation (no holder to return them).
 */
@Entity("inventory_stock_out_items")
export class InventoryStockOutItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "stock_out_id" })
    stockOutId!: number

    @ManyToOne(() => InventoryStockOut, (stockOut) => stockOut.items, { onDelete: "CASCADE" })
    @JoinColumn({ name: "stock_out_id" })
    stockOut!: Relation<InventoryStockOut>

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

    /** Condition the stock was taken from at assign time. */
    @Column({ name: "condition_assigned", type: "varchar" })
    conditionAssigned!: StockCondition

    @Column({ type: "integer" })
    quantity!: number

    @Column({ name: "quantity_returned", type: "integer", default: 0 })
    quantityReturned!: number

    @Index()
    @Column({ name: "returned_date", type: "varchar", nullable: true })
    returnedDate?: string | null

    @Column({ name: "return_note", type: "text", nullable: true })
    returnNote?: string | null

    @Index()
    @Column({ name: "return_handover_id", nullable: true })
    returnHandoverId?: number | null

    @ManyToOne(() => Handover, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "return_handover_id" })
    returnHandover?: Relation<Handover> | null

    @Column({ name: "returned_by", nullable: true })
    returnedByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "returned_by" })
    returnedBy?: Relation<User> | null
}
