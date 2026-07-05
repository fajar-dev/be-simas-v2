import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Asset } from "../../asset/entities/asset.entity"
import { User } from "../../user/entities/user.entity"

@Entity("asset_maintenances")
export class AssetMaintenance {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @Column({ type: "varchar" })
    date!: string

    @Column({ type: "text" })
    note!: string

    @Column({ type: "decimal", precision: 15, scale: 2, default: 0 })
    cost!: number

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
