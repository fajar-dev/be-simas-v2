import { User } from "../../user/entities/user.entity"
import { resolvePhotoUrl } from "../../../core/helpers/serializer-utils"

export class AuthSerializer {

    static async single(user: User) {
        return {
            id: user.id,
            name: user.name,
            photo: await resolvePhotoUrl(user.photo),
            email: user.email,
            isActive: Boolean(user.isActive),
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
