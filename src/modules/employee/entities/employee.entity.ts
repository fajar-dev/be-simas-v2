import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("employees")
export class Employee {
    @PrimaryGeneratedColumn()
    id!: number

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

    @Column({ name: "is_active", default: true })
    isActive!: boolean

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
