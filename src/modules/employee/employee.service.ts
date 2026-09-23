import { Employee } from "./entities/employee.entity"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { IEmployeeRepository } from "./interfaces/employee.repository.interface"
import { minio } from "../../core/helpers/minio"

export class EmployeeService {
    constructor(private readonly repository: IEmployeeRepository) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', isActive?: boolean): Promise<{ data: Employee[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order, isActive)
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
        const saved = await this.repository.save(data)
        // Reload with relations so the response includes the organization object.
        return await this.getById(saved.id)
    }

    async update(id: number, data: Partial<Employee>): Promise<Employee> {
        const employee = await this.getById(id)
        if (data.photo !== undefined) {
            data.photo = minio.sanitizePath(data.photo) ?? undefined
        }
        if (data.organizationId !== undefined) {
            // `employee.organization` was eagerly loaded above — save() would prioritize that stale relation over the new scalar.
            employee.organization = undefined as any
        }
        this.repository.merge(employee, data)
        await this.repository.save(employee)
        // Reload with relations so the response includes the organization object.
        return await this.getById(id)
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        const holderCount = await this.repository.countActiveAssetHolders(id)
        if (holderCount > 0) {
            throw new ConflictException(`Cannot delete employee, ${holderCount} asset(s) are still assigned to this employee`)
        }
        const userCount = await this.repository.countUsers(id)
        if (userCount > 0) {
            throw new ConflictException(`Cannot delete employee, ${userCount} user(s) are still linked to this employee`)
        }
        await this.repository.delete(id)
    }

    async save(data: Partial<Employee>, manager?: EntityManager): Promise<Employee> {
        return await this.repository.save(data, manager)
    }
}
