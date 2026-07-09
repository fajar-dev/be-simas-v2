import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm"

import { AssetHandover } from "./asset-handover.entity"
import { Asset } from "../../asset/entities/asset.entity"

@Entity("asset_handover_items")
export class AssetHandoverItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "handover_id" })
    handoverId!: number

    @ManyToOne(() => AssetHandover, (handover) => handover.items, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "handover_id" })
    handover!: AssetHandover

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Column({ type: "text", nullable: true })
    note?: string | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}