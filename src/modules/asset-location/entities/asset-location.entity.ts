import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Asset } from "../../asset/entities/asset.entity"
import { Location } from "../../location/entities/location.entity"
import { User } from "../../user/entities/user.entity"

@Entity("asset_locations")
export class AssetLocation {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: "asset_id" })
    assetId!: number

    @ManyToOne(() => Asset, { onDelete: "CASCADE" })
    @JoinColumn({ name: "asset_id" })
    asset!: Asset

    @Column({ name: "location_id" })
    locationId!: number

    @ManyToOne(() => Location, { onDelete: "CASCADE" })
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

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
