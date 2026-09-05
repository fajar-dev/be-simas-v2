import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { Inventory } from "./inventory.entity"

/** Custom key/value label attached to an inventory item (mirrors AssetLabel). */
@Entity("inventory_labels")
export class InventoryLabel {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "inventory_id" })
    inventoryId!: number

    @ManyToOne(() => Inventory, (inventory) => inventory.labels, { onDelete: "CASCADE" })
    @JoinColumn({ name: "inventory_id" })
    inventory!: Relation<Inventory>

    @Index()
    @Column()
    key!: string

    @Column()
    value!: string
}
