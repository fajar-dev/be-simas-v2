import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Asset } from "../../asset/entities/asset.entity"
import { Location } from "../../location/entities/location.entity"
import { User } from "../../user/entities/user.entity"

@Entity("asset_locations")
export class AssetLocation {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Index()
    @Column({ name: "location_id" })
    locationId!: number

    @ManyToOne(() => Location, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "location_id" })
    location!: Location

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @Column({ type: "varchar" })
    date!: string

    @Column({ nullable: true, type: "text" })
    note?: string

    @Column({ type: "varchar", default: "manual", name: "source" })
    source!: string

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
