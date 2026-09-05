import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Inventory } from "../../inventory/entities/inventory.entity"
import { User } from "../../user/entities/user.entity"

@Entity("inventory_logs")
export class InventoryLog {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "inventory_id" })
    inventoryId!: number

    @ManyToOne(() => Inventory, { onDelete: "CASCADE" })
    @JoinColumn({ name: "inventory_id" })
    inventory!: Inventory

    @Column()
    module!: string // e.g. 'inventory', 'stock'

    @Column()
    action!: string // e.g. 'create', 'update', 'delete', 'entry', 'stock_in', 'transfer', 'assign', 'return'

    @Column({ type: "text" })
    description!: string

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @Column({ name: "old_value", type: "text", nullable: true })
    oldValue?: string | null

    @Column({ name: "new_value", type: "text", nullable: true })
    newValue?: string | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
