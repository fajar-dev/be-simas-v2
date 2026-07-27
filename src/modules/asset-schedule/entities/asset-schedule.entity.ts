import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from "typeorm"
import type { Relation } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { AssetScheduleAsset } from "./asset-schedule-asset.entity"
import type { ScheduleRecurrence } from "../../../core/enums"

@Entity("asset_schedules")
export class AssetSchedule {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    title!: string

    @Column({ type: "text", nullable: true })
    description?: string | null

    /** First (or only) occurrence date, `YYYY-MM-DD`; also the lower bound of a recurring series. */
    @Index()
    @Column({ name: "start_date", type: "date" })
    startDate!: string

    @Column({ name: "recurrence", type: "varchar", default: "none" })
    recurrence!: ScheduleRecurrence

    /** weekly: weekdays it repeats on, 0=Sunday … 6=Saturday. */
    @Column({ name: "days_of_week", type: "simple-json", nullable: true })
    daysOfWeek?: number[] | null

    /** monthly & yearly: the day-of-month it repeats on, 1–31. */
    @Column({ name: "day_of_month", type: "int", nullable: true })
    dayOfMonth?: number | null

    /** yearly: the month it repeats in, 1–12. */
    @Column({ name: "recurrence_month", type: "int", nullable: true })
    month?: number | null

    /** Optional inclusive last date a recurrence may produce; null = open-ended. */
    @Column({ name: "recurrence_end_date", type: "date", nullable: true })
    recurrenceEndDate?: string | null

    @OneToMany(() => AssetScheduleAsset, (link) => link.schedule)
    scheduleAssets?: Relation<AssetScheduleAsset[]>

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: Relation<User> | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
