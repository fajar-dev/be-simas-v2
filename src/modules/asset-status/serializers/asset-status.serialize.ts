import { AssetStatus } from "../entities/asset-status.entity"
import { minio } from "../../../core/helpers/minio"

export class AssetStatusSerializer {
    private static async resolvePhotoUrl(photo?: string | null): Promise<string | null> {
        if (!photo) return null
        return await minio.getPresignedUrl(photo)
    }

    static async single(record: AssetStatus) {
        return {
            id: record.id,
            assetId: record.assetId,
            status: record.status,
            note: record.note || null,
            date: record.date,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            createdBy: record.createdBy ? {
                id: record.createdBy.id,
                name: record.createdBy.name,
                photo: await this.resolvePhotoUrl(record.createdBy.photo),
            } : null,
        }
    }

    static async collection(records: AssetStatus[]) {
        return Promise.all(records.map(r => this.single(r)))
    }
}
