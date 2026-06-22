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
        }
    }

    static async collection(users: User[]) {
        return Promise.all(users.map(u => this.single(u)))
    }
}
