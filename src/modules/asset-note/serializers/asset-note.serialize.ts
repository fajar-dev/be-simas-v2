import { AssetNote } from "../entities/asset-note.entity"
import { Attachment } from "../../attachment/entities/attachment.entity"
import { AttachmentSerializer } from "../../attachment/serializers/attachment.serialize"
import { resolveFileUrl } from "../../../core/helpers/serializer-utils"

export class AssetNoteSerializer {

    static async single(note: AssetNote, attachments: Attachment[] = []) {
        return {
            id: note.id,
            assetId: note.assetId,
            date: note.date,
            note: note.note,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            asset: note.asset ? {
                id: note.asset.id,
                name: note.asset.name,
                code: note.asset.code,
            } : null,
            createdBy: note.createdBy ? {
                id: note.createdBy.id,
                name: note.createdBy.name,
                photo: await resolveFileUrl(note.createdBy.photo),
            } : null,
            attachments: await AttachmentSerializer.collection(attachments),
            labels: ((note as any).labels || []).map((l: any) => ({ id: l.id, key: l.key, value: l.value })),
        }
    }

    static async collection(items: { note: AssetNote; attachments: Attachment[] }[]) {
        return Promise.all(items.map(item => this.single(item.note, item.attachments)))
    }
}
