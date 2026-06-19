import { Employee } from "./entities/employee.entity"
import { NotFoundException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { IEmployeeRepository } from "./interfaces/employee.repository.interface"
import { minio } from "../../core/helpers/minio"

export class EmployeeService {
    constructor(private readonly repository: IEmployeeRepository) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Employee[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order)
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
        await this.repository.delete(id)
    }

    async save(data: Partial<Employee>, manager?: EntityManager): Promise<Employee> {
        return await this.repository.save(data, manager)
    }
}
