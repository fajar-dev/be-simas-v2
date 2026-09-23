import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import type { TransferStatus } from "../../../core/enums"

@Entity("transfers")
export class Transfer {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    name!: string

    @Column({ type: "integer", nullable: true })
    price?: number | null

    // Serial numbers the sender provided, if any — may be fewer than `quantity` (rest completed at merge) or empty.
    @Column({ type: "simple-json", nullable: true })
    code?: string[] | null

    @Column({ type: "integer", default: 1 })
    quantity!: number

    @Column({ name: "purchase_date", type: "varchar", nullable: true })
    purchaseDate?: string | null

    // Free-text sender identifier — there's no authenticated user on this intake route.
    @Column({ name: "created_by", type: "varchar", nullable: true })
    createdBy?: string | null

    @Index()
    @Column({ type: "varchar", default: "pending" })
    status!: TransferStatus

    // One row can merge into several Assets (quantity > 1) — no FK/join table, just lightweight staging.
    @Column({ name: "merged_asset_ids", type: "simple-json", nullable: true })
    mergedAssetIds?: number[] | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date

    // Transient — populated by TransferService from `mergedAssetIds`, not a DB column.
    mergedAssets?: { id: number; code: string; name: string }[]
}
