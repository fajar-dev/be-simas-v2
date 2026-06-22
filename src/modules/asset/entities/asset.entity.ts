import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm"
import type { Relation } from "typeorm"
import { SubCategory } from "../../sub-category/entities/sub-category.entity"
import { AssetLabel } from "./asset-label.entity"
import { User } from "../../user/entities/user.entity"
import type { AssetHolder } from "../../asset-holder/entities/asset-holder.entity"
import type { AssetLocation } from "../../asset-location/entities/asset-location.entity"
import type { AssetStatus } from "../../asset-status/entities/asset-status.entity"

@Entity("assets")
export class Asset {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ unique: true })
    code!: string

    @Column()
    name!: string

    @Column({ nullable: true, type: "text" })
    description?: string

    @Column({ type: "integer", nullable: true })
    price?: number

    @Column({ name: "purchase_date", nullable: true })
    purchaseDate?: string

    @Column({ nullable: true })
    brand?: string

    @Column({ nullable: true })
    model?: string

    @Column({ nullable: true })
    image?: string

    @Column({ name: "sub_category_id" })
    subCategoryId!: number

    @ManyToOne(() => SubCategory, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "sub_category_id" })
    subCategory!: SubCategory

    @Column({ name: "created_by", nullable: true })
    createdByUserId?: number | null

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by" })
    createdBy?: User | null

    @Column({ name: "has_holder", type: "boolean", default: true })
    hasHolder!: boolean

    @Column({ name: "has_maintenance", type: "boolean", default: true })
    hasMaintenance!: boolean

    @Column({ name: "has_location", type: "boolean", default: true })
    hasLocation!: boolean

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date

    @OneToMany(() => AssetLabel, (label) => label.asset, { cascade: true, eager: true, orphanedRowAction: 'delete' })
    labels!: Relation<AssetLabel[]>

    // Transient/virtual fields populated at service layer
    activeHolder?: AssetHolder
    lastLocation?: AssetLocation
    lastStatus?: AssetStatus
}
