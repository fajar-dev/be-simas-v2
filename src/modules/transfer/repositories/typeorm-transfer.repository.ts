import { Brackets, EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Transfer } from "../entities/transfer.entity"
import { ITransferRepository, TransferFilter } from "../interfaces/transfer.repository.interface"

const SORTABLE = new Set(["name", "price", "quantity", "purchaseDate", "status", "createdAt"])

export class TypeOrmTransferRepository implements ITransferRepository {
    private readonly repository: Repository<Transfer>

    constructor() {
        this.repository = AppDataSource.getRepository(Transfer)
    }

    async findAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order: "ASC" | "DESC" = "DESC",
        filters?: TransferFilter
    ): Promise<{ data: Transfer[]; total: number }> {
        const offset = (page - 1) * limit
        const sortColumn = sortBy && SORTABLE.has(sortBy) ? sortBy : "createdAt"

        const query = this.repository.createQueryBuilder("transfer")
        if (q) {
            query.andWhere(
                new Brackets((qb) => {
                    qb.where("transfer.name LIKE :q", { q: `%${q}%` }).orWhere("transfer.code LIKE :q", { q: `%${q}%` })
                })
            )
        }
        if (filters?.status) {
            query.andWhere("transfer.status = :status", { status: filters.status })
        }

        const [data, total] = await query
            .orderBy(`transfer.${sortColumn}`, order)
            .addOrderBy("transfer.id", "DESC")
            .skip(offset)
            .take(limit)
            .getManyAndCount()

        return { data, total }
    }

    async findById(id: number): Promise<Transfer | null> {
        return await this.repository.findOneBy({ id })
    }

    async save(data: Partial<Transfer>, manager?: EntityManager): Promise<Transfer> {
        const repo = manager ? manager.getRepository(Transfer) : this.repository
        return await repo.save(data)
    }

    merge(entity: Transfer, data: Partial<Transfer>): Transfer {
        return this.repository.merge(entity, data)
    }
}
