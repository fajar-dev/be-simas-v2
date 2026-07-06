import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm"

@Index(["entityType", "entityId"])
@Entity("asset_labels")
export class AssetLabel {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column()
    key!: string

    @Column()
    value!: string

    @Column({ name: "entity_type" })
    entityType!: string

    @Column({ name: "entity_id", type: "integer" })
    entityId!: number
}
