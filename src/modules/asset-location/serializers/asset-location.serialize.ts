import { AssetLocation } from "../entities/asset-location.entity"
import { minio } from "../../../core/helpers/minio"

export class AssetLocationSerializer {
    private static async resolvePhotoUrl(photo?: string | null): Promise<string | null> {
        if (!photo) return null
        return await minio.getPresignedUrl(photo)
    }

    static async single(log: AssetLocation) {
        return {
            id: log.id,
            assetId: log.assetId,
            locationId: log.locationId,
            date: log.date,
            note: log.note || null,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
            asset: log.asset ? {
                id: log.asset.id,
                name: log.asset.name,
                code: log.asset.code,
            } : null,
            location: log.location ? {
                id: log.location.id,
                name: log.location.name,
                description: log.location.description || null,
            } : null,
            createdBy: log.createdBy ? {
                id: log.createdBy.id,
                name: log.createdBy.name,
                photo: await this.resolvePhotoUrl(log.createdBy.photo),
            } : null,
        }
    }

    static async collection(items: AssetLocation[]) {
        return Promise.all(items.map(item => this.single(item)))
    }
}
