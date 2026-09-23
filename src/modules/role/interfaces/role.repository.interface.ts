import { Role } from "../entities/role.entity"
import { Permission } from "../entities/permission.entity"

export interface IRoleRepository {
    findAllPermissions(): Promise<Permission[]>
    findPermissionsByIds(ids: number[]): Promise<Permission[]>
    findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Role[]; total: number }>
    findById(id: number): Promise<Role | null>
    findByName(name: string): Promise<Role | null>
    create(data: { name: string; permissions: Permission[] }): Role
    save(role: Role): Promise<Role>
    remove(role: Role): Promise<void>
    countUsers(roleId: number): Promise<number>
}
