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
import { InventoryVariant } from "../../inventory-variant/entities/inventory-variant.entity"
import { Branch } from "../../branch/entities/branch.entity"
import { Employee } from "../../employee/entities/employee.entity"
import { User } from "../../user/entities/user.entity"
import { Handover } from "../../handover/entities/handover.entity"
import type { StockCondition } from "../../../core/enums"

/**
 * Quantity a given employee currently holds of a stock variant — the stock
 * analogue of `AssetHolder`. A holding is partially returnable: the remaining
 * held amount is `quantity - quantityReturned`, and it is fully returned once
 * `returnedDate` is set.
 */
@Entity("inventory_stock_holdings")
export class InventoryStockHolding {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "variant_id" })
    variantId!: number

    @ManyToOne(() => InventoryVariant, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "variant_id" })
    variant!: Relation<InventoryVariant>

    @Index()
    @Column({ name: "employee_id" })
    employeeId!: number

    @ManyToOne(() => Employee, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "employee_id" })
    employee!: Relation<Employee>

    @Index()
    @Column({ name: "branch_id" })
    branchId!: number

    @ManyToOne(() => Branch, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "branch_id" })
    branch!: Relation<Branch>

    /** Condition the stock was taken from at assign time. */
    @Column({ name: "condition_assigned", type: "varchar" })
    conditionAssigned!: StockCondition

    @Column({ type: "integer" })
    quantity!: number

    @Column({ name: "quantity_returned", type: "integer", default: 0 })
    quantityReturned!: number

    @Column({ name: "assigned_date", type: "varchar" })
    assignedDate!: string

    @Index()
    @Column({ name: "returned_date", type: "varchar", nullable: true })
    returnedDate?: string | null

    @Column({ name: "assign_note", type: "text", nullable: true })
    assignNote?: string | null

    @Column({ name: "return_note", type: "text", nullable: true })
    returnNote?: string | null

    @Index()
    @Column({ name: "assign_handover_id", nullable: true })
    assignHandoverId?: number | null

    @ManyToOne(() => Handover, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "assign_handover_id" })
    assignHandover?: Relation<Handover> | null

    @Index()
    @Column({ name: "return_handover_id", nullable: true })
    returnHandoverId?: number | null

    @ManyToOne(() => Handover, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "return_handover_id" })
    returnHandover?: Relation<Handover> | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @Column({ name: "returned_by", nullable: true })
    returnedByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "returned_by" })
    returnedBy?: Relation<User> | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
