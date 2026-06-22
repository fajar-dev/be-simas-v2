import { Employee } from "./entities/employee.entity"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { EntityManager, IsNull } from "typeorm"
import { AppDataSource } from "../../config/database"
import { AssetHolder } from "../asset-holder/entities/asset-holder.entity"
import { User } from "../user/entities/user.entity"
import { IEmployeeRepository } from "./interfaces/employee.repository.interface"
import { minio } from "../../core/helpers/minio"

export class EmployeeService {
    constructor(private readonly repository: IEmployeeRepository) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Employee[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order)
    }

    async getList(isActive?: boolean): Promise<Employee[]> {
        return await this.repository.findList(isActive)
    }

    async getById(id: number): Promise<Employee> {
        const employee = await this.repository.findById(id)
        if (!employee) {
            throw new NotFoundException("Employee not found")
        }
        return employee
    }

    async create(data: Partial<Employee>): Promise<Employee> {
        if (data.photo !== undefined) {
            data.photo = minio.sanitizePath(data.photo) ?? undefined
        }
        return await this.repository.save(data)
    }

    async update(id: number, data: Partial<Employee>): Promise<Employee> {
        const employee = await this.getById(id)
        if (data.photo !== undefined) {
            data.photo = minio.sanitizePath(data.photo) ?? undefined
        }
        this.repository.merge(employee, data)
        return await this.repository.save(employee)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        const holderCount = await AppDataSource.getRepository(AssetHolder).count({ where: { employeeId: id, returnedDate: IsNull() } })
        if (holderCount > 0) {
            throw new ConflictException(`Cannot delete employee, ${holderCount} asset(s) are still assigned to this employee`)
        }
        const userCount = await AppDataSource.getRepository(User).count({ where: { employeeId: id } })
        if (userCount > 0) {
            throw new ConflictException(`Cannot delete employee, ${userCount} user(s) are still linked to this employee`)
        }
        await this.repository.delete(id)
    }

    async save(data: Partial<Employee>, manager?: EntityManager): Promise<Employee> {
        return await this.repository.save(data, manager)
    }
}
