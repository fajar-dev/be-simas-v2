import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("categories")
export class Category {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    name!: string

    @Column({ nullable: true, type: "text" })
    description?: string

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
