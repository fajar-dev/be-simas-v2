import { EntityManager, Repository } from "typeorm"
import { AppDataSource } from "../../../config/database"
import { Employee } from "../entities/employee.entity"
import { IEmployeeRepository } from "../interfaces/employee.repository.interface"

export class TypeOrmEmployeeRepository implements IEmployeeRepository {
    private readonly repository: Repository<Employee>

    constructor() {
        this.repository = AppDataSource.getRepository(Employee)
    }

    async findAll(page: number, limit: number, q: string): Promise<{ data: Employee[]; total: number }> {
        const offset = (page - 1) * limit

        const query = this.repository.createQueryBuilder("employee")

        if (q) {
            query.where(
                "(employee.name LIKE :q OR employee.employee_id LIKE :q OR employee.email LIKE :q OR employee.job_position LIKE :q)",
                { q: `%${q}%` }
            )
        }

        const total = await query.getCount()

        const data = await query
            .orderBy("employee.id", "DESC")
            .skip(offset)
            .take(limit)
            .getMany()

        return { data, total }
    }

    async findById(id: number): Promise<Employee | null> {
        return await this.repository.findOneBy({ id })
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
