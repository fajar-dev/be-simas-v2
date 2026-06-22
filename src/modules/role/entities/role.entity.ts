import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from "typeorm"
import { Permission } from "./permission.entity"

@Entity("roles")
export class Role {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ unique: true })
    name!: string

    @Column({ name: "is_super_admin", default: false })
    isSuperAdmin!: boolean

    @ManyToMany(() => Permission, { eager: true })
    @JoinTable({
        name: "role_permissions",
        joinColumn: { name: "role_id" },
        inverseJoinColumn: { name: "permission_id" },
    })
    permissions!: Permission[]

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date
}
