import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm"
import type { Relation } from "typeorm"
import { SubCategory } from "../../sub-category/entities/sub-category.entity"
import { AssetLabel } from "./asset-label.entity"

@Entity("assets")
export class Asset {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ unique: true })
    code!: string

    @Column()
    name!: string

    @Column({ nullable: true })
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

    @ManyToOne(() => SubCategory)
    @JoinColumn({ name: "sub_category_id" })
    subCategory!: SubCategory

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date

    @OneToMany(() => AssetLabel, (label) => label.asset, { cascade: true, eager: true, orphanedRowAction: 'delete' })
    labels!: Relation<AssetLabel[]>
}
