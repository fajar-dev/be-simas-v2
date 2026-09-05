import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm"
import type { Relation } from "typeorm"
import { AssetSchedule } from "./asset-schedule.entity"
import { User } from "../../user/entities/user.entity"

/** Join row linking one schedule to one assigned user (a schedule may notify many users, or none). */
@Entity("asset_schedule_users")
export class AssetScheduleUser {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "schedule_id" })
    scheduleId!: number

    @ManyToOne(() => AssetSchedule, (schedule) => schedule.scheduleUsers, { onDelete: "CASCADE" })
    @JoinColumn({ name: "schedule_id" })
    schedule!: Relation<AssetSchedule>

    @Index()
    @Column({ name: "user_id" })
    userId!: number

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: Relation<User>
}
