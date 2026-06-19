import { EntityManager } from "typeorm"
import { Employee } from "../entities/employee.entity"

export interface IEmployeeRepository {
    findAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Employee[]; total: number }>
    findById(id: number): Promise<Employee | null>
    save(data: Partial<Employee>, manager?: EntityManager): Promise<Employee>
    merge(entity: Employee, data: Partial<Employee>): Employee
    delete(id: number): Promise<void>
}
