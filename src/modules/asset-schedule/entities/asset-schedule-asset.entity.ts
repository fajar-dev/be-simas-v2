import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm"
import type { Relation } from "typeorm"
import { AssetSchedule } from "./asset-schedule.entity"
import { Asset } from "../../asset/entities/asset.entity"

/** Join row linking one schedule to one of its assets (a schedule may cover many). */
@Entity("asset_schedule_assets")
export class AssetScheduleAsset {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "schedule_id" })
    scheduleId!: number

    @ManyToOne(() => AssetSchedule, (schedule) => schedule.scheduleAssets, { onDelete: "CASCADE" })
    @JoinColumn({ name: "schedule_id" })
    schedule!: Relation<AssetSchedule>

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "CASCADE" })
    @JoinColumn({ name: "asset_id" })
    asset!: Relation<Asset>
}
