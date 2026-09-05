import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { SubCategory } from "../../sub-category/entities/sub-category.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { InventoryLabel } from "./inventory-label.entity"

/** A type of operational/facility good tracked by quantity (not per-unit like Asset). */
@Entity("inventories")
export class Inventory {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar", nullable: true })
    code?: string | null

    @Column({ type: "varchar" })
    name!: string

    @Column({ type: "text", nullable: true })
    description?: string | null

    @Column({ type: "varchar", nullable: true })
    image?: string | null

    /** Unit of measure for the item and all its variants, e.g. Pcs / Box / Roll. */
    @Column({ type: "varchar", default: "Pcs" })
    unit!: string

    @Index()
    @Column({ name: "sub_category_id", nullable: true })
    subCategoryId?: number | null

    @ManyToOne(() => SubCategory, { onDelete: "RESTRICT", nullable: true })
    @JoinColumn({ name: "sub_category_id" })
    subCategory?: Relation<SubCategory> | null

    @Column({ name: "is_active", type: "boolean", default: true })
    isActive!: boolean

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @OneToMany(() => InventoryVariant, (variant) => variant.inventory)
    variants?: Relation<InventoryVariant[]>

    @OneToMany(() => InventoryLabel, (label) => label.inventory)
    labels?: Relation<InventoryLabel[]>

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date

    /** Not persisted — populated by the list query (number of variants). */
    variantCount?: number

    /** Not persisted — populated by the list query (on-hand "new" condition stock quantity). */
    newCount?: number

    /** Not persisted — populated by the list query (on-hand "used" condition stock quantity). */
    usedCount?: number
}
