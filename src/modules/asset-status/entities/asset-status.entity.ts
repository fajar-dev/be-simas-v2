import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Asset } from "../../asset/entities/asset.entity"
import { User } from "../../user/entities/user.entity"

@Entity("asset_statuses")
export class AssetStatus {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "CASCADE" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Index()
    @Column({ type: "varchar" })
    status!: string

    @Column({ type: "text", nullable: true })
    note?: string | null

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
