import { resolvePhotoUrl } from "../../../core/helpers/serializer-utils"

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

    static async single(item: FeedbackItem) {
        return {
            timestamp: item.timestamp,
            userId: item.userId,
            name: item.name,
            images: await Promise.all(item.image.map((photo) => resolvePhotoUrl(photo))),
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