import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { InventoryStockTransfer } from "./inventory-stock-transfer.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import type { StockCondition } from "../../../core/enums"

@Entity("inventory_stock_transfer_items")
export class InventoryStockTransferItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "transfer_id" })
    transferId!: number

    @ManyToOne(() => InventoryStockTransfer, (transfer) => transfer.items, { onDelete: "CASCADE" })
    @JoinColumn({ name: "transfer_id" })
    transfer!: Relation<InventoryStockTransfer>

    @Index()
    @Column({ name: "variant_id" })
    variantId!: number

    @ManyToOne(() => InventoryVariant, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "variant_id" })
    variant!: Relation<InventoryVariant>

    @Column({ type: "varchar" })
    condition!: StockCondition

    @Column({ type: "integer" })
    quantity!: number
}
