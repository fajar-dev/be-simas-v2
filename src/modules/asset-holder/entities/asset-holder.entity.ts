import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Asset } from "../../asset/entities/asset.entity"
import { Employee } from "../../employee/entities/employee.entity"
import { User } from "../../user/entities/user.entity"

@Entity("asset_holders")
export class AssetHolder {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Index()
    @Column({ name: "employee_id" })
    employeeId!: number

    @ManyToOne(() => Employee, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "employee_id" })
    employee!: Employee

    @Column({ name: "assigned_date", type: "varchar" })
    assignedDate!: string

    @Index()
    @Column({ name: "returned_date", type: "varchar", nullable: true })
    returnedDate?: string | null

    @Column({ name: "assign_note", type: "text", nullable: true })
    assignNote?: string | null

    @Column({ name: "return_note", type: "text", nullable: true })
    returnNote?: string | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @Column({ name: "returned_by", nullable: true })
    returnedByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "returned_by" })
    returnedBy?: User | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
