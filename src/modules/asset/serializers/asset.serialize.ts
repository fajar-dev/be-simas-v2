import { Asset } from "../entities/asset.entity"
import { minio } from "../../../core/helpers/minio"

export class AssetSerializer {
    private static async resolveImageUrl(image?: string | null): Promise<string | null> {
        if (!image) return null
        return await minio.getPresignedUrl(image)
    }

    static async single(asset: Asset) {
        return {
            id: asset.id,
            code: asset.code,
            name: asset.name,
            description: asset.description || null,
            price: asset.price ?? null,
            purchaseDate: asset.purchaseDate || null,
            brand: asset.brand || null,
            model: asset.model || null,
            image: await this.resolveImageUrl(asset.image),
            rawImage: asset.image || null, // useful if frontend wants to edit
            subCategoryId: asset.subCategoryId,
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
