import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from "typeorm"
import type { Relation } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"

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

    @Column({ name: "is_active", type: "boolean", default: true })
    isActive!: boolean

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @OneToMany(() => InventoryVariant, (variant) => variant.product)
    variants?: Relation<InventoryVariant[]>

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
