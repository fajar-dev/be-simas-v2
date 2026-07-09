import { User } from "../entities/user.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class UserSerializer {

    static async single(user: User) {
        return {
            id: user.id,
            name: user.name,
            photo: await resolveFileUrl(user.photo),
            email: user.email,
            isActive: Boolean(user.isActive),
            role: user.role ? { id: user.role.id, name: user.role.name } : null,
            employee: user.employee ? {
                id: user.employee.id,
                name: user.employee.name,
                employeeId: user.employee.employeeId,
                jobPosition: user.employee.jobPosition,
                photo: await resolveFileUrl(user.employee.photo),
            } : null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }
    }

    static async collection(users: User[]) {
        return Promise.all(users.map(user => this.single(user)))
    }
}

