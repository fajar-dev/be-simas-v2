import { AssetLog } from "../entities/asset-log.entity"
import { minio } from "../../../core/helpers/minio"

export class AssetLogSerializer {
    private static async resolvePhotoUrl(photo?: string | null): Promise<string | null> {
        if (!photo) return null
        return await minio.getPresignedUrl(photo)
    }

    static async single(log: AssetLog) {
        return {
            id: log.id,
            assetId: log.assetId,
            action: log.action,
            description: log.description,
            createdAt: log.createdAt,
            createdBy: log.createdBy ? {
                id: log.createdBy.id,
                name: log.createdBy.name,
                photo: await this.resolvePhotoUrl(log.createdBy.photo),
                email: log.createdBy.email
            } : null
        }
    }

    static async collection(logs: AssetLog[]) {
        return Promise.all(logs.map(log => this.single(log)))
    }
}
