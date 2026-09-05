import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import type { Relation } from "typeorm"
import { Organization } from "../../organization/entities/organization.entity"

@Entity("employees")
export class Employee {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column()
    name!: string

    @Column({ name: "employee_id", unique: true })
    employeeId!: string

    @Column({ name: "job_position" })
    jobPosition!: string

    @Column({ unique: true })
    email!: string

    @Column()
    phone!: string

    @Column({ nullable: true })
    photo?: string

    @Index()
    @Column({ name: "organization_id", nullable: true })
    organizationId!: number | null

    @ManyToOne(() => Organization, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "organization_id" })
    organization?: Relation<Organization> | null

    @Index()
    @Column({ name: "is_active", default: true })
    isActive!: boolean

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
