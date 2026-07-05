import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Employee } from "../entities/employee.entity"
import { IEmployeeRepository } from "../interfaces/employee.repository.interface"

export class EmployeeRepository implements IEmployeeRepository {
    private readonly repository: Repository<Employee>

    constructor() {
        this.repository = AppDataSource.getRepository(Employee)
    }

    async findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', isActive?: boolean): Promise<{ data: Employee[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("employee")
            .addSelect(subQuery => {
                return subQuery
                    .select("COUNT(ah.id)", "count")
                    .from("asset_holders", "ah")
                    .where("ah.employee_id = employee.id")
                    .andWhere("ah.returned_date IS NULL")
            }, "assetCount")

        if (q) {
            query.where(
                "(employee.name LIKE :q OR employee.employeeId LIKE :q OR employee.email LIKE :q OR employee.jobPosition LIKE :q)",
                { q: `%${q}%` }
            )
        }

        if (isActive !== undefined) {
            query.andWhere("employee.isActive = :isActive", { isActive })
        }

        const total = await query.getCount()

        // Whitelist of allowed sort columns mapped to entity properties
        const sortColumnMap: Record<string, string> = {
            name: "employee.name",
            employeeId: "employee.employeeId",
            jobPosition: "employee.jobPosition",
            email: "employee.email",
            phone: "employee.phone",
        }

        const sortColumn = sortColumnMap[sortBy || ''] || "employee.id"
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

        const data = await query
            .orderBy(sortColumn, sortOrder)
            .skip(offset)
            .take(limit)
            .getRawAndEntities()

        const result = data.entities.map((entity, i) => {
            (entity as any).assetCount = parseInt(data.raw[i].assetCount || '0', 10)
            return entity
        })

        return { data: result, total }
    }

    async findById(id: number): Promise<Employee | null> {
        return await this.repository.findOneBy({ id })
    }

    async findList(isActive?: boolean): Promise<Employee[]> {
        const where: any = {}
        if (isActive !== undefined) where.isActive = isActive
        return await this.repository.find({ where, order: { name: 'ASC' } })
    }

    async save(data: Partial<Employee>, manager?: EntityManager): Promise<Employee> {
        const repo = manager ? manager.getRepository(Employee) : this.repository
        return await repo.save(data)
    }

    merge(entity: Employee, data: Partial<Employee>): Employee {
        return this.repository.merge(entity, data)
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id)
    }
}
