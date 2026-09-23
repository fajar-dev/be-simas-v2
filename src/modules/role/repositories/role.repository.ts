import { In, Like, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Role } from "../entities/role.entity"
import { Permission } from "../entities/permission.entity"
import { User } from "../../user/entities/user.entity"
import { IRoleRepository } from "../interfaces/role.repository.interface"

export class RoleRepository implements IRoleRepository {
    private readonly repository: Repository<Role>
    private readonly permissionRepository: Repository<Permission>

    constructor() {
        this.repository = AppDataSource.getRepository(Role)
        this.permissionRepository = AppDataSource.getRepository(Permission)
    }

    async findAllPermissions(): Promise<Permission[]> {
        return await this.permissionRepository.find({ order: { module: "ASC", action: "ASC" } })
    }

    async findPermissionsByIds(ids: number[]): Promise<Permission[]> {
        return await this.permissionRepository.find({ where: { id: In(ids) } })
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Role[]; total: number }> {
        const where = q ? { name: Like(`%${q}%`) } : {}

        const sortColumnMap: Record<string, string> = {
            name: "name",
            createdAt: "createdAt",
        }
        const sortColumn = sortColumnMap[sortBy || ''] || "id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const [data, total] = await this.repository.findAndCount({
            where,
            order: { [sortColumn]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        })
        return { data, total }
    }

    async findById(id: number): Promise<Role | null> {
        return await this.repository.findOne({ where: { id } })
    }

    async findByName(name: string): Promise<Role | null> {
        return await this.repository.findOne({ where: { name } })
    }

    create(data: { name: string; permissions: Permission[] }): Role {
        return this.repository.create(data)
    }

    async save(role: Role): Promise<Role> {
        return await this.repository.save(role)
    }

    async remove(role: Role): Promise<void> {
        await this.repository.remove(role)
    }

    async countUsers(roleId: number): Promise<number> {
        return await AppDataSource.getRepository(User).count({ where: { roleId } })
    }
}
