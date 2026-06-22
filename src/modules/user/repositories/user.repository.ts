import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { User } from "../entities/user.entity"
import { IUserRepository, UserListFilters } from "../interfaces/user.repository.interface"

export class UserRepository implements IUserRepository {
    private readonly repository: Repository<User>

    constructor() {
        this.repository = AppDataSource.getRepository(User)
    }

    async findAll(page: number, limit: number, q: string, filters: UserListFilters = {}, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: User[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("user")
            .leftJoinAndSelect("user.role", "role")
            .leftJoinAndSelect("role.permissions", "permissions")
            .leftJoinAndSelect("user.employee", "employee")

        if (q) {
            query.where(
                "(user.name LIKE :q OR user.email LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (filters.isActive !== undefined && filters.isActive !== "") {
            query.andWhere("user.isActive = :isActive", { isActive: filters.isActive === "1" })
        }

        // Get total count before pagination
        const total = await query.getCount()

        // Whitelist of allowed sort columns
        const sortColumnMap: Record<string, string> = {
            name: "user.name",
            email: "user.email",
            isActive: "user.isActive",
            createdAt: "user.createdAt",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "user.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        // Get paginated data
        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<User | null> {
        return await this.repository.createQueryBuilder("user")
            .leftJoinAndSelect("user.role", "role")
            .leftJoinAndSelect("role.permissions", "permissions")
            .leftJoinAndSelect("user.employee", "employee")
            .where("user.id = :id", { id })
            .getOne()
    }

    async findByEmail(email: string): Promise<User | null> {
        return await this.repository.findOneBy({ email })
    }

    async findByEmailWithPassword(email: string): Promise<User | null> {
        return await this.repository.createQueryBuilder("user")
            .leftJoinAndSelect("user.role", "role")
            .leftJoinAndSelect("role.permissions", "permissions")
            .where("user.email = :email", { email })
            .addSelect("user.password")
            .getOne()
    }

    async findByIdWithPassword(id: number): Promise<User | null> {
        return await this.repository.createQueryBuilder("user")
            .leftJoinAndSelect("user.role", "role")
            .leftJoinAndSelect("role.permissions", "permissions")
            .where("user.id = :id", { id })
            .addSelect("user.password")
            .getOne()
    }

    async findByResetToken(token: string): Promise<User | null> {
        return await this.repository.createQueryBuilder("user")
            .where("user.reset_password_token = :token", { token })
            .andWhere("user.reset_password_expires > :now", { now: new Date() })
            .getOne()
    }

    async findByEmailAndResetToken(email: string, token: string): Promise<User | null> {
        return await this.repository.createQueryBuilder("user")
            .where("user.email = :email", { email })
            .andWhere("user.reset_password_token = :token", { token })
            .andWhere("user.reset_password_expires > :now", { now: new Date() })
            .getOne()
    }

    async save(data: Partial<User>, manager?: EntityManager): Promise<User> {
        const repo = manager ? manager.getRepository(User) : this.repository
        return await repo.save(data)
    }

    merge(entity: User, data: Partial<User>): User {
        return this.repository.merge(entity, data)
    }

    async saveInTransaction(data: Partial<User>): Promise<User> {
        return AppDataSource.transaction(async (manager) => {
            return await manager.getRepository(User).save(data)
        })
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
