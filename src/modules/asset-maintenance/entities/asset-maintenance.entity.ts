import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Asset } from "../../asset/entities/asset.entity"

@Entity("asset_maintenances")
export class AssetMaintenance {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "CASCADE" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Column({ type: "varchar" })
    date!: string

    @Column({ nullable: true, type: "varchar" })
    note?: string

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
