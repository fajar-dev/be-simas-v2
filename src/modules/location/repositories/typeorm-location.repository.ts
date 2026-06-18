import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Location } from "../entities/location.entity"
import { ILocationRepository } from "../interfaces/location.repository.interface"

export class TypeOrmLocationRepository implements ILocationRepository {
    private readonly repository: Repository<Location>

    constructor() {
        this.repository = AppDataSource.getRepository(Location)
    }

    async findAll(page: number, limit: number, q: string): Promise<{ data: Location[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("location")
            .leftJoinAndSelect("location.branch", "branch")

        if (q) {
            query.where(
                "(location.name LIKE :q OR location.description LIKE :q OR branch.name LIKE :q)",
                { q: `%${q}%` }
            )
        }

        const total = await query.getCount()

        const data = await query
            .orderBy("location.id", "DESC")
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<Location | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ["branch"]
        })
    }

    async save(data: Partial<Location>, manager?: EntityManager): Promise<Location> {
        const repo = manager ? manager.getRepository(Location) : this.repository
        return await repo.save(data)
    }

    merge(entity: Location, data: Partial<Location>): Location {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
