import { Asset } from "../entities/asset.entity"
import { minio } from "../../../core/helpers/minio"

export class AssetSerializer {
    private static async resolveImageUrl(image?: string | null): Promise<string | null> {
        if (!image) return null
        return await minio.getPresignedUrl(image)
    }

    private static calculateAge(purchaseDate?: string | null): string | null {
        if (!purchaseDate) return null
        const start = new Date(purchaseDate)
        const now = new Date()

        let years = now.getFullYear() - start.getFullYear()
        let months = now.getMonth() - start.getMonth()
        let days = now.getDate() - start.getDate()

        if (days < 0) {
            months--
            const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
            days += prevMonth.getDate()
        }
        if (months < 0) {
            years--
            months += 12
        }

        const parts: string[] = []
        if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`)
        if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`)
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`)

        return parts.length > 0 ? parts.join(' ') : '0 days'
    }

    static async single(asset: Asset) {
        return {
            id: asset.id,
            code: asset.code,
            name: asset.name,
            description: asset.description || null,
            price: asset.price ?? null,
            purchaseDate: asset.purchaseDate || null,
            age: this.calculateAge(asset.purchaseDate),
            brand: asset.brand || null,
            model: asset.model || null,
            image: await this.resolveImageUrl(asset.image),
            subCategory: asset.subCategory ? {
                id: asset.subCategory.id,
                name: asset.subCategory.name,
                category: asset.subCategory.category ? {
                    id: asset.subCategory.category.id,
                    name: asset.subCategory.category.name,
                } : null,
            } : null,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
        }
    }

    static async collection(assets: Asset[]) {
        return Promise.all(assets.map(asset => this.single(asset)))
    }
}
