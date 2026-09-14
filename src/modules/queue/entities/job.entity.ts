import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

@Entity("jobs")
export class Job {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ default: "default" })
    queue!: string

    @Column({ name: "job_type" })
    jobType!: string

    @Column({ type: "json" })
    payload!: Record<string, any>

    @Column({ default: 0 })
    attempts!: number

    @Column({ name: "reserved_at", type: "datetime", precision: 6, nullable: true })
    reservedAt!: Date | null

    @Index()
    @Column({ name: "available_at", type: "datetime", precision: 6 })
    availableAt!: Date

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
