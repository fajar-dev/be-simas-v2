import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Category } from "../../category/entities/category.entity"

@Entity("sub_categories")
export class SubCategory {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ unique: true })
    code!: string

    @Index()
    @Column()
    name!: string

    @Column({ nullable: true, type: "text" })
    description?: string

    @Index()
    @Column({ name: "category_id" })
    categoryId!: number

    @ManyToOne(() => Category, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "category_id" })
    category!: Category

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
