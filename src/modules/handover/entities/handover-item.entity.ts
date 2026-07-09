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
import type { Relation } from "typeorm"
import { Handover } from "./handover.entity"
import { Asset } from "../../asset/entities/asset.entity"

@Entity("handover_items")
export class HandoverItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "handover_id" })
    handoverId!: number

    @ManyToOne(() => Handover, (handover) => handover.items, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "handover_id" })
    handover!: Relation<Handover>

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "asset_id" })
    asset!: Relation<Asset>

    @Column({ type: "text", nullable: true })
    note?: string | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}