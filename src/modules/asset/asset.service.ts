import { Asset } from "./entities/asset.entity"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { IAssetRepository } from "./interfaces/asset.repository.interface"
import { minio } from "../../core/helpers/minio"
import { AppDataSource } from "../../config/database"
import { Employee } from "../employee/entities/employee.entity"
import { Location } from "../location/entities/location.entity"
import { AssetHolder } from "../asset-holder/entities/asset-holder.entity"
import { AssetLocation } from "../asset-location/entities/asset-location.entity"

export class AssetService {
    constructor(private readonly repository: IAssetRepository) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC'): Promise<{ data: Asset[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order)
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

    async create(data: any): Promise<Asset> {
        // Extract assignment and relocation fields
        const {
            employeeId,
            assignedDate,
            assignNote,
            locationId,
            locationDate,
            locationNote,
            createdByUserId,
            ...assetData
        } = data

        if (assetData.image !== undefined) {
            assetData.image = minio.sanitizePath(assetData.image) ?? undefined
        }

        // Validate employee if provided
        if (employeeId) {
            const employeeRepo = AppDataSource.getRepository(Employee)
            const employeeExists = await employeeRepo.findOneBy({ id: employeeId })
            if (!employeeExists) {
                throw new NotFoundException("Employee not found")
            }
        }

        // Validate location if provided
        if (locationId) {
            const locationRepo = AppDataSource.getRepository(Location)
            const locationExists = await locationRepo.findOneBy({ id: locationId })
            if (!locationExists) {
                throw new NotFoundException("Location not found")
            }
        }

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            // Save asset
            const assetPayload = {
                ...assetData,
                createdByUserId,
            }
            const asset = await this.repository.save(assetPayload, queryRunner.manager)

            // Save assignment log if employeeId is provided
            if (employeeId) {
                const holderRepo = queryRunner.manager.getRepository(AssetHolder)
                const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                await holderRepo.save({
                    assetId: asset.id,
                    employeeId,
                    assignedDate: assignedDate || nowStr,
                    assignNote: assignNote || null,
                    createdByUserId,
                })
            }

            // Save relocation log if locationId is provided
            if (locationId) {
                const locationRepo = queryRunner.manager.getRepository(AssetLocation)
                const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                await locationRepo.save({
                    assetId: asset.id,
                    locationId,
                    date: locationDate || nowStr,
                    note: locationNote || null,
                    createdByUserId,
                })
            }

            await queryRunner.commitTransaction()
            return asset
        } catch (error: any) {
            await queryRunner.rollbackTransaction()
            if (error?.message?.includes("UNIQUE") || error?.message?.includes("Duplicate entry")) {
                throw new BadRequestException("Asset code must be unique")
            }
            throw error
        } finally {
            await queryRunner.release()
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
