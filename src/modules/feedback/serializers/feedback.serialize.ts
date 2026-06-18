import minio from "../../../core/helpers/minio"

export interface FeedbackItem {
    timestamp: string
    userId: string
    name: string
    image: string[]
    url: string
    category: string
    message: string
    type: string
    reply: string
}

export class FeedbackSerializer {
    private static async resolvePhotoUrl(photo?: string | null): Promise<string | null> {
        if (!photo) return null
        return await minio.getPresignedUrl(photo)
    }

    static async single(item: FeedbackItem) {
        return {
            timestamp: item.timestamp,
            userId: item.userId,
            name: item.name,
            images: await Promise.all(item.image.map((photo) => this.resolvePhotoUrl(photo))),
            url: item.url,
            category: item.category,
            message: item.message,
            type: item.type,
            reply: item.reply,
        }
    }

    static async collection(items: FeedbackItem[]) {
        return await Promise.all(items.map((item) => this.single(item)))
    }
}