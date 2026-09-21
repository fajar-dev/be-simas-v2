import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity("failed_jobs")
export class FailedJob {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ unique: true })
    uuid!: string

    @Column({ default: "default" })
    queue!: string

    @Column({ name: "job_type" })
    jobType!: string

    @Column({ type: "json" })
    payload!: Record<string, any>

    @Column({ type: "text" })
    exception!: string

    @CreateDateColumn({ name: "failed_at" })
    failedAt!: Date
}
