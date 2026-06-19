import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("attachments")
export class Attachment {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: "original_name" })
    originalName!: string

    @Column()
    filename!: string // path in minio

    @Column({ name: "mime_type" })
    mimeType!: string

    @Column({ type: "integer" })
    size!: number

    @Column({ name: "entity_type", nullable: true })
    entityType?: string

    @Column({ name: "entity_id", nullable: true, type: "integer" })
    entityId?: number

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
