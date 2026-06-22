import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity("permissions")
export class Permission {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ unique: true })
    key!: string

    @Column()
    module!: string

    @Column()
    action!: string
}
