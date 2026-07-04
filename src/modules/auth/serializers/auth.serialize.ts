import { User } from "../../user/entities/user.entity"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class AuthSerializer {

    static async single(user: User) {
        return {
            id: user.id,
            name: user.name,
            photo: await resolveFileUrl(user.photo),
            email: user.email,
            isActive: Boolean(user.isActive),
            employee: user.employee ? {
                id: user.employee.id,
                employeeId: user.employee.employeeId,
                name: user.employee.name,
            } : null,
            hasPassword: !!user.password,
            role: user.role ? {
                id: user.role.id,
                name: user.role.name,
                isSuperAdmin: user.role.isSuperAdmin,
                permissions: (user.role.permissions || []).map(p => ({ id: p.id, key: p.key })),
            } : null,
        }
    }

    static async collection(users: User[]) {
        return Promise.all(users.map(u => this.single(u)))
    }
}
