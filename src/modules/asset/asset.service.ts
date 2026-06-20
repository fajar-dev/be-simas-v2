import { Asset } from "./entities/asset.entity"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { IAssetRepository } from "./interfaces/asset.repository.interface"
import { minio } from "../../core/helpers/minio"
import { AppDataSource } from "../../config/database"
import { Employee } from "../employee/entities/employee.entity"
import { AssetHolder } from "../asset-holder/entities/asset-holder.entity"
import { AssetLocation } from "../asset-location/entities/asset-location.entity"
import { Location } from "../location/entities/location.entity"
import { attachmentService } from "../attachment/attachment.module"

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
        const {
            employeeId,
            assignedDate,
            assignNote,
            assignAttachmentIds,
            locationId,
            locationDate,
            locationNote,
            locationAttachmentIds,
            ...assetData
        } = data

        if (assetData.image !== undefined) {
            assetData.image = minio.sanitizePath(assetData.image) ?? undefined
        }

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            // 1. Save Asset
            const asset = await this.repository.save(assetData, queryRunner.manager)

            // 2. If employeeId is provided, create AssetHolder
            if (employeeId) {
                // Validate employee exists
                const employeeRepo = queryRunner.manager.getRepository(Employee)
                const employeeExists = await employeeRepo.findOneBy({ id: employeeId })
                if (!employeeExists) {
                    throw new NotFoundException("Employee not found")
                }

                const holderRepo = queryRunner.manager.getRepository(AssetHolder)
                const log = await holderRepo.save({
                    assetId: asset.id,
                    employeeId,
                    assignedDate: assignedDate || new Date().toISOString().split('T')[0],
                    assignNote: assignNote || null,
                    createdByUserId: assetData.createdByUserId,
                })

                if (assignAttachmentIds && assignAttachmentIds.length > 0) {
                    await attachmentService.associate(assignAttachmentIds, "AssetHolder", log.id, queryRunner.manager)
                }
            }

            // 3. If locationId is provided, create AssetLocation
            if (locationId) {
                // Validate location exists
                const locationRepo = queryRunner.manager.getRepository(Location)
                const locationExists = await locationRepo.findOneBy({ id: locationId })
                if (!locationExists) {
                    throw new NotFoundException("Location not found")
                }

                const locationLogRepo = queryRunner.manager.getRepository(AssetLocation)
                const log = await locationLogRepo.save({
                    assetId: asset.id,
                    locationId,
                    date: locationDate || new Date().toISOString().split('T')[0],
                    note: locationNote || null,
                    createdByUserId: assetData.createdByUserId,
                })

                if (locationAttachmentIds && locationAttachmentIds.length > 0) {
                    await attachmentService.associate(locationAttachmentIds, "AssetLocation", log.id, queryRunner.manager)
                }
            }

            await queryRunner.commitTransaction()

            // Fetch the fully loaded asset (with category, branch, etc.)
            const full = await this.repository.findById(asset.id)
            if (!full) throw new NotFoundException("Asset not found after creation")
            return full
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
