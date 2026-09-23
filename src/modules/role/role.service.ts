import { Role } from "./entities/role.entity"
import { Permission } from "./entities/permission.entity"
import { IRoleRepository } from "./interfaces/role.repository.interface"
import { NotFoundException, BadRequestException, ConflictException } from "../../core/exceptions/base"

export class RoleService {
    constructor(private readonly repository: IRoleRepository) {}

    async getAllPermissions(): Promise<Permission[]> {
        return await this.repository.findAllPermissions()
    }

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Role[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order)
    }

    async getById(id: number): Promise<Role> {
        const role = await this.repository.findById(id)
        if (!role) {
            throw new NotFoundException("Role not found")
        }
        return role
    }

    async create(data: { name: string; permissionIds: number[] }): Promise<Role> {
        const existing = await this.repository.findByName(data.name)
        if (existing) {
            throw new BadRequestException("Role name already exists")
        }

        const permissions = await this.repository.findPermissionsByIds(data.permissionIds)
        if (permissions.length !== data.permissionIds.length) {
            throw new BadRequestException("Some permissions were not found")
        }

        const role = this.repository.create({ name: data.name, permissions })
        return await this.repository.save(role)
    }

    async update(id: number, data: { name?: string; permissionIds?: number[] }): Promise<Role> {
        const role = await this.getById(id)

        if (data.name && data.name !== role.name) {
            const existing = await this.repository.findByName(data.name)
            if (existing) {
                throw new BadRequestException("Role name already exists")
            }
            role.name = data.name
        }

        if (data.permissionIds) {
            const permissions = await this.repository.findPermissionsByIds(data.permissionIds)
            if (permissions.length !== data.permissionIds.length) {
                throw new BadRequestException("Some permissions were not found")
            }
            role.permissions = permissions
        }

        return await this.repository.save(role)
    }

    async delete(id: number): Promise<void> {
        const role = await this.getById(id)

        if (role.isSuperAdmin) {
            throw new BadRequestException("Cannot delete Super Admin role")
        }

        const usersCount = await this.repository.countUsers(id)
        if (usersCount > 0) {
            throw new ConflictException(`Cannot delete role, ${usersCount} user(s) are still assigned to this role`)
        }

        await this.repository.remove(role)
    }
}
