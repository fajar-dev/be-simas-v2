import { AssetStatus } from "../entities/asset-status.entity"
import { resolvePhotoUrl } from "../../../core/helpers/serializer-utils"

export class AssetStatusSerializer {

    static async single(record: AssetStatus) {
        return {
            id: record.id,
            assetId: record.assetId,
            status: record.status,
            note: record.note || null,
            createdAt: record.createdAt,
            createdBy: record.createdBy ? {
                id: record.createdBy.id,
                name: record.createdBy.name,
                photo: await resolvePhotoUrl(record.createdBy.photo),
            } : null,
        }
    }

    static async collection(records: AssetStatus[]) {
        return Promise.all(records.map(r => this.single(r)))
    }
}
