import { In, Like } from "typeorm"
import { AppDataSource } from "../../config/database"
import { Role } from "./entities/role.entity"
import { Permission } from "./entities/permission.entity"
import { User } from "../user/entities/user.entity"
import { NotFoundException, BadRequestException, ConflictException } from "../../core/exceptions/base"

export class RoleService {
    private get roleRepository() {
        return AppDataSource.getRepository(Role)
    }

    private get permissionRepository() {
        return AppDataSource.getRepository(Permission)
    }

    private get userRepository() {
        return AppDataSource.getRepository(User)
    }

    async getAllPermissions(): Promise<Permission[]> {
        return await this.permissionRepository.find({
            order: { module: "ASC", action: "ASC" },
        })
    }

    async getAll(page: number, limit: number, q: string): Promise<{ data: Role[]; total: number }> {
        const where = q ? { name: Like(`%${q}%`) } : {}
        const [data, total] = await this.roleRepository.findAndCount({
            where,
            order: { id: "DESC" },
            skip: (page - 1) * limit,
            take: limit,
        })
        return { data, total }
    }

    async getById(id: number): Promise<Role> {
        const role = await this.roleRepository.findOne({
            where: { id },
        })
        if (!role) {
            throw new NotFoundException("Role not found")
        }
        return role
    }

    async create(data: { name: string; permissionIds: number[] }): Promise<Role> {
        const existing = await this.roleRepository.findOne({ where: { name: data.name } })
        if (existing) {
            throw new BadRequestException("Role name already exists")
        }

        const permissions = await this.permissionRepository.find({
            where: { id: In(data.permissionIds) },
        })

        if (permissions.length !== data.permissionIds.length) {
            throw new BadRequestException("Some permissions were not found")
        }

        const role = this.roleRepository.create({
            name: data.name,
            permissions,
        })

        return await this.roleRepository.save(role)
    }

    async update(id: number, data: { name?: string; permissionIds?: number[] }): Promise<Role> {
        const role = await this.getById(id)

        if (data.name && data.name !== role.name) {
            const existing = await this.roleRepository.findOne({ where: { name: data.name } })
            if (existing) {
                throw new BadRequestException("Role name already exists")
            }
            role.name = data.name
        }

        if (data.permissionIds) {
            const permissions = await this.permissionRepository.find({
                where: { id: In(data.permissionIds) },
            })
            if (permissions.length !== data.permissionIds.length) {
                throw new BadRequestException("Some permissions were not found")
            }
            role.permissions = permissions
        }

        return await this.roleRepository.save(role)
    }

    async delete(id: number): Promise<void> {
        const role = await this.getById(id)

        if (role.isSuperAdmin) {
            throw new BadRequestException("Cannot delete Super Admin role")
        }

        const usersCount = await this.userRepository.count({ where: { roleId: id } })
        if (usersCount > 0) {
            throw new ConflictException(`Cannot delete role, ${usersCount} user(s) are still assigned to this role`)
        }

        await this.roleRepository.remove(role)
    }
}
