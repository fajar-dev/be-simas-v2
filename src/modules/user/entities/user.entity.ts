import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Role } from "../../role/entities/role.entity"
import { Employee } from "../../employee/entities/employee.entity"

@Entity("users")
export class User {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column()
    name!: string

    @Column({ nullable: true })
    photo?: string

    @Column({ unique: true })
    email!: string

    @Column({ select: false, nullable: true })
    password?: string

    @Column({ name: "reset_password_token", nullable: true })
    resetPasswordToken?: string

    @Column({ name: "reset_password_expires", type: "timestamp", nullable: true })
    resetPasswordExpires?: Date

    @Index()
    @Column({ name: "is_active", default: true })
    isActive!: boolean

    @Index()
    @Column({ name: "role_id", nullable: true })
    roleId?: number

    @ManyToOne(() => Role, { eager: true, nullable: true, onDelete: "RESTRICT" })
    @JoinColumn({ name: "role_id" })
    role?: Role

    @Index()
    @Column({ name: "employee_id", nullable: true })
    employeeId?: number | null

    @ManyToOne(() => Employee, { nullable: true, onDelete: "RESTRICT" })
    @JoinColumn({ name: "employee_id" })
    employee?: Employee

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date

    @Index()
    @Column({ name: "deleted_at", type: "timestamp", nullable: true, default: null })
    deletedAt?: Date | null
}

