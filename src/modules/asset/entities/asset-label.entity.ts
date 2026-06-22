import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm"
import type { Asset } from "./asset.entity"

@Entity("asset_labels")
export class AssetLabel {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column()
    key!: string

    @Column()
    value!: string

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne("Asset", "labels", { onDelete: "CASCADE" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset
}
