import { Asset } from "./entities/asset.entity"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { EntityManager } from "typeorm"
import { IAssetRepository } from "./interfaces/asset.repository.interface"
import { AssetFilter } from "./interfaces/asset.repository.interface"
import { minio } from "../../core/helpers/minio"
import { attachmentService } from "../attachment/attachment.module"
import { assetLogService } from "../asset-log/asset-log.module"
import { withTransaction } from "../../core/helpers/transaction"

export class AssetService {
    constructor(private readonly repository: IAssetRepository) {}

    // Lazy getters — resolve circular deps at call-time, not import-time
    private get assetHolderService() { return require("../asset-holder/asset-holder.module").assetHolderService }
    private get assetLocationService() { return require("../asset-location/asset-location.module").assetLocationService }
    private get assetStatusService() { return require("../asset-status/asset-status.module").assetStatusService }
    private get employeeService() { return require("../employee/employee.module").employeeService }
    private get locationService() { return require("../location/location.module").locationService }

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: AssetFilter): Promise<{ data: Asset[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, filters)
        await Promise.all(data.map(asset => this.populateRelations(asset)))
        return { data, total }
    }

    async getById(id: number): Promise<Asset> {
        const asset = await this.repository.findById(id)
        if (!asset) {
            throw new NotFoundException("Asset not found")
        }
        await this.populateRelations(asset)
        return asset
    }

    private async populateRelations(asset: Asset): Promise<void> {
        // Load activeHolder
        if (asset.hasHolder) {
            asset.activeHolder = await this.assetHolderService.findActiveHolder(asset.id)
        }

        // Load lastLocation
        if (asset.hasLocation) {
            asset.lastLocation = await this.assetLocationService.findLastLocation(asset.id)
        }

        // Load lastStatus
        asset.lastStatus = await this.assetStatusService.findLastStatus(asset.id)
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
            status: initialStatus,
            statusNote,
            ...assetData
        } = data

        if (assetData.image !== undefined) {
            assetData.image = minio.sanitizePath(assetData.image) ?? undefined
        }

        // Validate employee exists before starting transaction
        let employeeExists: any = null
        if (employeeId) {
            employeeExists = await this.employeeService.getById(employeeId)
        }

        // Validate location exists before starting transaction
        let locationExists: any = null
        if (locationId) {
            locationExists = await this.locationService.getById(locationId)
        }

        try {
            const asset = await withTransaction(async (manager) => {
                // 1. Save Asset
                const asset = await this.repository.save(assetData, manager)

                // Log Asset registration
                await assetLogService.log({
                    assetId: asset.id,
                    module: "asset",
                    action: "create",
                    description: "Asset registered.",
                    createdByUserId: assetData.createdByUserId,
                }, manager)

                // 2. If employeeId is provided, create AssetHolder
                if (employeeId) {
                    const log = await this.assetHolderService.save({
                        assetId: asset.id,
                        employeeId,
                        assignedDate: assignedDate || new Date().toISOString().split('T')[0],
                        assignNote: assignNote || null,
                        createdByUserId: assetData.createdByUserId,
                    }, manager)

                    if (assignAttachmentIds && assignAttachmentIds.length > 0) {
                        await attachmentService.associate(assignAttachmentIds, "AssetHolder", log.id, manager)
                    }

                    // Log Asset assignment
                    await assetLogService.log({
                        assetId: asset.id,
                        module: "holder",
                        action: "assign",
                        description: `Asset assigned to employee "${employeeExists.name}".`,
                        createdByUserId: assetData.createdByUserId,
                    }, manager)
                }

                // 3. If locationId is provided, create AssetLocation
                if (locationId) {
                    const log = await this.assetLocationService.save({
                        assetId: asset.id,
                        locationId,
                        date: locationDate || new Date().toISOString().split('T')[0],
                        note: locationNote || null,
                        createdByUserId: assetData.createdByUserId,
                    }, manager)

                    if (locationAttachmentIds && locationAttachmentIds.length > 0) {
                        await attachmentService.associate(locationAttachmentIds, "AssetLocation", log.id, manager)
                    }

                    // Log Asset relocation
                    await assetLogService.log({
                        assetId: asset.id,
                        module: "location",
                        action: "relocate",
                        description: `Asset location set to "${locationExists.name}".`,
                        createdByUserId: assetData.createdByUserId,
                    }, manager)
                }

                // 4. If status is provided, create AssetStatus
                if (initialStatus) {
                    await this.assetStatusService.save({
                        assetId: asset.id,
                        status: initialStatus,
                        note: statusNote || null,
                        createdByUserId: assetData.createdByUserId,
                    }, manager)

                    await assetLogService.log({
                        assetId: asset.id,
                        module: "status",
                        action: "update",
                        description: `Asset status set to "${initialStatus}".`,
                        createdByUserId: assetData.createdByUserId,
                    }, manager)
                }

                return asset
            })

            // Fetch the fully loaded asset (with category, branch, etc.)
            return await this.getById(asset.id)
        } catch (error: any) {
            if (error?.message?.includes("UNIQUE") || error?.message?.includes("Duplicate entry")) {
                throw new BadRequestException("Asset code must be unique")
            }
            throw error
        }
    }

    async update(id: number, data: Partial<Asset>, operatorId?: number): Promise<Asset> {
        const asset = await this.getById(id)

        // Capture old values before merge
        const oldValue = { ...asset }

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

            await assetLogService.log({
                assetId: id,
                module: "asset",
                action: "update",
                description: "Asset updated.",
                createdByUserId: operatorId,
                oldValue,
                newValue: data,
            })

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

    async getUniqueLabelKeys(): Promise<string[]> {
        return await this.repository.getUniqueLabelKeys()
    }
}
