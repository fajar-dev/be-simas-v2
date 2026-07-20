import { Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { AssetHolder } from "../../asset-holder/entities/asset-holder.entity"
import { IBookRepository, BookLoanFilters } from "../interfaces/book.repository.interface"

const BOOK_CATEGORY = "Buku"

export class TypeOrmBookRepository implements IBookRepository {
    private readonly repository: Repository<AssetHolder>

    constructor() {
        this.repository = AppDataSource.getRepository(AssetHolder)
    }

    async findLoans(filters: BookLoanFilters): Promise<AssetHolder[]> {
        const { search, startDate, endDate, hasReturn } = filters

        const query = this.repository.createQueryBuilder("ah")
            .leftJoinAndSelect("ah.asset", "asset")
            .leftJoinAndSelect("ah.employee", "employee")
            .leftJoinAndSelect("asset.subCategory", "subCategory")
            .leftJoinAndSelect("subCategory.category", "category")
            .where("category.name = :categoryName", { categoryName: BOOK_CATEGORY })

        if (hasReturn !== undefined) {
            if (hasReturn) {
                query.andWhere("ah.returnedDate IS NOT NULL")
            } else {
                query.andWhere("ah.returnedDate IS NULL")
            }
        }

        if (search) {
            query.andWhere(
                "(employee.name LIKE :search OR employee.employeeId LIKE :search OR asset.name LIKE :search)",
                { search: `%${search}%` }
            )
        }

        if (startDate && endDate) {
            query.andWhere("ah.returnedDate BETWEEN :startDate AND :endDate", { startDate, endDate })
        } else if (startDate) {
            query.andWhere("ah.returnedDate >= :startDate", { startDate })
        } else if (endDate) {
            query.andWhere("ah.returnedDate <= :endDate", { endDate })
        }

        return await query.orderBy("ah.assignedDate", "DESC").getMany()
    }

    async findActiveLoans(employeeId: number): Promise<AssetHolder[]> {
        return await this.repository.createQueryBuilder("ah")
            .leftJoinAndSelect("ah.asset", "asset")
            .leftJoinAndSelect("ah.employee", "employee")
            .leftJoinAndSelect("ah.createdBy", "createdBy")
            .leftJoinAndSelect("ah.returnedBy", "returnedBy")
            .leftJoinAndSelect("ah.assignHandover", "assignHandover")
            .leftJoinAndSelect("ah.returnHandover", "returnHandover")
            .leftJoin("asset.subCategory", "subCategory")
            .leftJoin("subCategory.category", "category")
            .where("category.name = :categoryName", { categoryName: BOOK_CATEGORY })
            .andWhere("ah.employeeId = :employeeId", { employeeId })
            .andWhere("ah.returnedDate IS NULL")
            .orderBy("ah.assignedDate", "DESC")
            .getMany()
    }
}
