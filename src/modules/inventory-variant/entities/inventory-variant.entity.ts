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

/** A variant/specification (SKU level) of a stock product. */
@Entity("inventory_variants")
export class InventoryVariant {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "product_id" })
    productId!: number

    @ManyToOne(() => Inventory, (product) => product.variants, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "product_id" })
    product!: Relation<Inventory>

    @Column({ type: "varchar" })
    name!: string

    @Column({ type: "varchar", nullable: true })
    code?: string | null

    /** Unit of measure, e.g. pcs / meter / box. */
    @Column({ type: "varchar", default: "pcs" })
    unit!: string

    @Column({ name: "is_active", type: "boolean", default: true })
    isActive!: boolean

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
