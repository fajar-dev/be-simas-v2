import { AssetLog } from "../entities/asset-log.entity"
import { resolvePhotoUrl } from "../../../core/helpers/serializer-utils"

export class AssetLogSerializer {

    static async single(log: AssetLog) {
        return {
            id: log.id,
            assetId: log.assetId,
            module: log.module,
            action: log.action,
            description: log.description,
            createdAt: log.createdAt,
            createdBy: log.createdBy ? {
                id: log.createdBy.id,
                name: log.createdBy.name,
                photo: await resolvePhotoUrl(log.createdBy.photo),
                email: log.createdBy.email
            } : null
        }
    }

    static async collection(logs: AssetLog[]) {
        return Promise.all(logs.map(log => this.single(log)))
    }
}
