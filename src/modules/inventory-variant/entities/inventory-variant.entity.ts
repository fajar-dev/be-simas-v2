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
import { Inventory } from "../../inventory/entities/inventory.entity"

/** A variant/specification (SKU level) of an inventory item. */
@Entity("inventory_variants")
export class InventoryVariant {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "inventory_id" })
    inventoryId!: number

    @ManyToOne(() => Inventory, (inventory) => inventory.variants, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "inventory_id" })
    inventory!: Relation<Inventory>

    @Column({ type: "varchar" })
    name!: string

    @Column({ type: "varchar", nullable: true })
    code?: string | null

    @Column({ type: "varchar", nullable: true })
    image?: string | null

    @Column({ type: "text", nullable: true })
    description?: string | null

    @Column({ name: "is_active", type: "boolean", default: true })
    isActive!: boolean

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
