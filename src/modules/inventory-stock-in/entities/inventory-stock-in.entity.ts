import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from "typeorm"
import type { Relation } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { InventoryStockInItem } from "./inventory-stock-in-item.entity"

/**
 * A stock-in document (incoming stock) — the header that groups the line items
 * of one stock-in action so the history can be shown grouped with its items,
 * mirroring the transfer document.
 */
@Entity("inventory_stock_in")
export class InventoryStockIn {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "text", nullable: true })
    note?: string | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @OneToMany(() => InventoryStockInItem, (item) => item.stockIn)
    items?: Relation<InventoryStockInItem[]>

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
