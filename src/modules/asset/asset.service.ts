import { Asset } from "./entities/asset.entity"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { IAssetRepository } from "./interfaces/asset.repository.interface"
import { minio } from "../../core/helpers/minio"

export class AssetService {
    constructor(private readonly repository: IAssetRepository) {}

    async getAll(page: number, limit: number, q: string): Promise<{ data: Asset[]; total: number }> {
        return await this.repository.findAll(page, limit, q)
    }

    async getById(id: number): Promise<Asset> {
        const asset = await this.repository.findById(id)
        if (!asset) {
            throw new NotFoundException("Asset not found")
        }
        return asset
    }

    async checkCode(code: string, excludeId?: number): Promise<boolean> {
        const asset = await this.repository.findByCode(code)
        if (asset && excludeId && asset.id === excludeId) return false
        return !!asset
    }

    async create(data: Partial<Asset>): Promise<Asset> {
        if (data.image !== undefined) {
            data.image = minio.sanitizePath(data.image) ?? undefined
        }
        try {
            return await this.repository.save(data)
        } catch (error: any) {
            if (error?.message?.includes("UNIQUE") || error?.message?.includes("Duplicate entry")) {
                throw new BadRequestException("Asset code must be unique")
            }
            throw error
        }
    }

    async update(id: number, data: Partial<Asset>): Promise<Asset> {
        const asset = await this.getById(id)
        if (data.image !== undefined) {
            data.image = minio.sanitizePath(data.image) ?? undefined
        }
        // Extract labels before merge
        const newLabels = data.labels
        delete data.labels

        this.repository.merge(asset, data)
        try {
            const saved = await this.repository.save(asset)
            // Handle labels: delete old, insert new
            if (newLabels !== undefined) {
                await this.repository.deleteLabels(id)
                if (newLabels && newLabels.length > 0) {
                    await this.repository.saveLabels(id, newLabels as any)
                }
            }
            return await this.getById(id)
        } catch (error: any) {
            if (error?.message?.includes("UNIQUE") || error?.message?.includes("Duplicate entry")) {
                throw new BadRequestException("Asset code must be unique")
            }
            throw error
        }
    }

    async delete(id: number): Promise<void> {
        await this.getById(id)
        await this.repository.delete(id)
    }

    async save(data: Partial<Asset>, manager?: EntityManager): Promise<Asset> {
        return await this.repository.save(data, manager)
    }
}
