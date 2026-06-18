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

    async checkCode(code: string): Promise<boolean> {
        const asset = await this.repository.findByCode(code)
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
        // Handle labels replacement
        if (data.labels !== undefined) {
            asset.labels = (data.labels || []) as any
            delete data.labels
        }
        this.repository.merge(asset, data)
        try {
            return await this.repository.save(asset)
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
