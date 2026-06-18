import { Employee } from "../entities/employee.entity"
import { minio } from "../../../core/helpers/minio"

export class EmployeeSerializer {
    private static async resolvePhotoUrl(photo?: string | null): Promise<string | null> {
        if (!photo) return null
        return await minio.getPresignedUrl(photo)
    }

    static async single(employee: Employee) {
        return {
            id: employee.id,
            employeeId: employee.employeeId,
            name: employee.name,
            jobPosition: employee.jobPosition,
            email: employee.email,
            phone: employee.phone,
            photo: await this.resolvePhotoUrl(employee.photo),
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        }
    }

    static async collection(employees: Employee[]) {
        return Promise.all(employees.map(employee => this.single(employee)))
    }
}
