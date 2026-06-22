import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Role } from "../../role/entities/role.entity"

@Entity("users")
export class User {
    @PrimaryGeneratedColumn()
    id!: number

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

    @Column({ name: "is_active", default: true })
    isActive!: boolean

    @Column({ name: "role_id", nullable: true })
    roleId?: number

    @ManyToOne(() => Role, { eager: true, nullable: true })
    @JoinColumn({ name: "role_id" })
    role?: Role

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}

