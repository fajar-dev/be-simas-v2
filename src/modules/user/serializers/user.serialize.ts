import { User } from "../entities/user.entity"
import { resolvePhotoUrl } from "../../../core/helpers/serializer-utils"

export class UserSerializer {

    static async single(user: User) {
        return {
            id: user.id,
            name: user.name,
            photo: await resolvePhotoUrl(user.photo),
            email: user.email,
            isActive: Boolean(user.isActive),
            role: user.role ? { id: user.role.id, name: user.role.name } : null,
            roleId: user.roleId || null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }
    }

    static async collection(users: User[]) {
        return Promise.all(users.map(user => this.single(user)))
    }
}
