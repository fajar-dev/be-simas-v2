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
    module!: string // e.g. 'asset', 'holder', 'location', 'maintenance'

    @Column()
    action!: string // e.g. 'create', 'update', 'delete', 'assign', 'return', 'relocate'

    @Column({ type: "text" })
    description!: string

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @Column({ name: "old_value", type: "text", nullable: true })
    oldValue?: string | null

    @Column({ name: "new_value", type: "text", nullable: true })
    newValue?: string | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
