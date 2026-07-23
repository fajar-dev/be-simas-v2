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
import { Employee } from "../../employee/entities/employee.entity"
import { User } from "../../user/entities/user.entity"
import { Handover } from "../../handover/entities/handover.entity"
import { InventoryStockOutItem } from "./inventory-stock-out-item.entity"
import type { StockOutType } from "../../../core/enums"

/**
 * A stock-out document — the header that groups the line items of one
 * "take stock out" action, mirroring the stock-in/transfer document. Either
 * goes to an employee (`type: "employee"`, its items are individually
 * returnable) or to some other one-way destination (`type: "other"`, e.g.
 * consumed, disposed, sold — `employeeId` is null and its items are marked
 * fully resolved at creation since there's no holder to return them from).
 */
@Entity("inventory_stock_out")
export class InventoryStockOut {
    @PrimaryGeneratedColumn()
    id!: number

    /** Whether this stock went to an employee (returnable) or elsewhere (one-way). */
    @Column({ type: "varchar" })
    type!: StockOutType

    @Index()
    @Column({ name: "employee_id", nullable: true })
    employeeId?: number | null

    @ManyToOne(() => Employee, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "employee_id" })
    employee?: Relation<Employee> | null

    @Column({ name: "assigned_date", type: "varchar" })
    assignedDate!: string

    @Column({ name: "assign_note", type: "text", nullable: true })
    assignNote?: string | null

    @Index()
    @Column({ name: "assign_handover_id", nullable: true })
    assignHandoverId?: number | null

    @ManyToOne(() => Handover, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "assign_handover_id" })
    assignHandover?: Relation<Handover> | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @OneToMany(() => InventoryStockOutItem, (item) => item.stockOut)
    items?: Relation<InventoryStockOutItem[]>

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
