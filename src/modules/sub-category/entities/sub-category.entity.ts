import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Category } from "../../category/entities/category.entity"

@Entity("sub_categories")
export class SubCategory {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    name!: string

    @Column({ nullable: true, type: "text" })
    description?: string

    @Column({ name: "category_id" })
    categoryId!: number

    @ManyToOne(() => Category)
    @JoinColumn({ name: "category_id" })
    category!: Category

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
