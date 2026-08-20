import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { InventoryStockOpname } from "./inventory-stock-opname.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import type { StockCondition } from "../../../core/enums"

/** One line of a stock opname document (a single variant/condition recount). */
@Entity("inventory_stock_opname_items")
export class InventoryStockOpnameItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "opname_id" })
    opnameId!: number

    @ManyToOne(() => InventoryStockOpname, (opname) => opname.items, { onDelete: "CASCADE" })
    @JoinColumn({ name: "opname_id" })
    opname!: Relation<InventoryStockOpname>

    @Index()
    @Column({ name: "variant_id" })
    variantId!: number

    @ManyToOne(() => InventoryVariant, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "variant_id" })
    variant!: Relation<InventoryVariant>

    @Column({ type: "varchar" })
    condition!: StockCondition

    /** Recorded on-hand quantity before this count. */
    @Column({ name: "system_quantity", type: "integer" })
    systemQuantity!: number

    /** Physical quantity counted. */
    @Column({ name: "counted_quantity", type: "integer" })
    countedQuantity!: number

    /** Signed delta applied to the balance (countedQuantity - systemQuantity). */
    @Column({ type: "integer" })
    quantity!: number
}
