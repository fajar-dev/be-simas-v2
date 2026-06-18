import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Branch } from "../entities/branch.entity"
import { IBranchRepository } from "../interfaces/branch.repository.interface"

export class TypeOrmBranchRepository implements IBranchRepository {
    private readonly repository: Repository<Branch>

    constructor() {
        this.repository = AppDataSource.getRepository(Branch)
    }

    async findAll(page: number, limit: number, q: string): Promise<{ data: Branch[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("branch")

        if (q) {
            query.where(
                "(branch.name LIKE :q OR branch.code LIKE :q OR branch.description LIKE :q)",
                { q: `%${q}%` }
            )
        }

        const total = await query.getCount()

        const data = await query
            .orderBy("branch.id", "DESC")
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<Branch | null> {
        return await this.repository.findOneBy({ id })
    }

    async save(data: Partial<Branch>, manager?: EntityManager): Promise<Branch> {
        const repo = manager ? manager.getRepository(Branch) : this.repository
        return await repo.save(data)
    }

    merge(entity: Branch, data: Partial<Branch>): Branch {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
