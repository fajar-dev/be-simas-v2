import { Employee } from "../entities/employee.entity"
import { resolvePhotoUrl } from "../../../core/helpers/serializer-utils"

export class EmployeeSerializer {

    static async single(employee: Employee) {
        return {
            id: employee.id,
            employeeId: employee.employeeId,
            name: employee.name,
            jobPosition: employee.jobPosition,
            email: employee.email,
            phone: employee.phone,
            photo: await resolvePhotoUrl(employee.photo),
            isActive: Boolean(employee.isActive),
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        }
    }

    static async collection(employees: Employee[]) {
        return Promise.all(employees.map(employee => this.single(employee)))
    }

    static async listItem(employee: Employee) {
        return {
            id: employee.id,
            name: employee.name,
            employeeId: employee.employeeId,
            photo: await resolvePhotoUrl(employee.photo),
        }
    }

    static async listCollection(employees: Employee[]) {
        return Promise.all(employees.map(e => this.listItem(e)))
    }
}
