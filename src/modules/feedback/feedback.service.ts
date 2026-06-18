import { config } from "../../config/config"
import { FeedbackItem } from "./serializers/feedback.serialize"
import { minio } from "../../core/helpers/minio"

export class FeedbackService {
    async store(userId: number, name: string, data: { message: string; type: string; url?: string }, imageFiles: File[]) {
        const timestamp = Date.now()
        const imageUrls: string[] = []

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i]
            const rawExt = file.type.split("/")[1]
            const ext = rawExt === "jpeg" ? "jpg" : rawExt
            const objectName = `feedback/${userId}_${timestamp}_${i}.${ext}`

            const buffer = Buffer.from(await file.arrayBuffer())
            await minio.upload(objectName, buffer, file.type)

            const url = minio.getProxyUrl(objectName)
            imageUrls.push(url)
        }

        fetch(config.feedback.scriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: String(userId),
                name,
                image: imageUrls,
                url: data.url ?? "",
                type: data.type,
                message: data.message,
            }),
        }).catch(() => {})

        return imageUrls
    }

    async getByUser(userId: number): Promise<FeedbackItem[]> {
        const response = await fetch(config.feedback.scriptUrl)
        if (!response.ok) {
            return []
        }

        const data = await response.json() as FeedbackItem[]
        return data.filter((item) => String(item.userId) === String(userId))
    }
}