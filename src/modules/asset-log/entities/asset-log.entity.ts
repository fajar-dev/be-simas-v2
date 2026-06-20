import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Asset } from "../../asset/entities/asset.entity"
import { User } from "../../user/entities/user.entity"

@Entity("asset_logs")
export class AssetLog {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "CASCADE" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Column()
    action!: string // e.g. 'create', 'update', 'assign', 'return', 'relocate', 'maintenance_create', 'maintenance_update', 'maintenance_delete'

    @Column({ type: "text" })
    description!: string

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
