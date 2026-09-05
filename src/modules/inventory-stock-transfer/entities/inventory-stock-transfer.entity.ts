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
import { Branch } from "../../branch/entities/branch.entity"
import { User } from "../../user/entities/user.entity"
import { InventoryStockTransferItem } from "./inventory-stock-transfer-item.entity"

/** A stock transfer document (from one branch to another) — history + attachments. */
@Entity("inventory_stock_transfers")
export class InventoryStockTransfer {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "from_branch_id" })
    fromBranchId!: number

    @ManyToOne(() => Branch, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "from_branch_id" })
    fromBranch!: Relation<Branch>

    @Index()
    @Column({ name: "to_branch_id" })
    toBranchId!: number

    @ManyToOne(() => Branch, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "to_branch_id" })
    toBranch!: Relation<Branch>

    @Column({ type: "text", nullable: true })
    note?: string | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @OneToMany(() => InventoryStockTransferItem, (item) => item.transfer)
    items?: Relation<InventoryStockTransferItem[]>

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
