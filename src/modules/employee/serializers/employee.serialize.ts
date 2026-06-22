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
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        }
    }

    static async collection(employees: Employee[]) {
        return Promise.all(employees.map(employee => this.single(employee)))
    }
}
