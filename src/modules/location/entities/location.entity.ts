import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Branch } from "../../branch/entities/branch.entity"

@Entity("locations")
export class Location {
    @PrimaryGeneratedColumn()
    id!: number

    @Index()
    @Column()
    name!: string

    @Column({ nullable: true, type: "text" })
    description?: string

    @Index()
    @Column({ name: "branch_id" })
    branchId!: number

    @ManyToOne(() => Branch, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "branch_id" })
    branch!: Branch

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
