import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class UserListSerializer {

    static async single(row: any) {
        return {
            id: row.id,
            name: row.name,
            photo: await resolveFileUrl(row.photo),
            email: row.email || null,
            isActive: Boolean(row.isActive),
            role: row.role ? { id: row.role.id, name: row.role.name } : null,
            roleId: row.roleId || null,
        }
    }

    static async collection(rows: any[]) {
        return Promise.all(rows.map(row => this.single(row)))
    }
}
