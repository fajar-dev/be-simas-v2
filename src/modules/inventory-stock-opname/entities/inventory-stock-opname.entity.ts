import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { Branch } from "../../branch/entities/branch.entity"
import { InventoryStockOpnameItem } from "./inventory-stock-opname-item.entity"

/**
 * A stock opname (physical count) document — the header that groups the line
 * items of one counting session at a branch, mirroring the stock-in document.
 */
@Entity("inventory_stock_opname")
export class InventoryStockOpname {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "branch_id" })
    branchId!: number

    @ManyToOne(() => Branch, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "branch_id" })
    branch!: Relation<Branch>

    @Column({ type: "text", nullable: true })
    note?: string | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @OneToMany(() => InventoryStockOpnameItem, (item) => item.opname)
    items?: Relation<InventoryStockOpnameItem[]>

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
