import { AssetLocation } from "./entities/asset-location.entity"
import { IAssetLocationRepository } from "./interfaces/asset-location.repository.interface"
import { Asset } from "../asset/entities/asset.entity"
import { Location } from "../location/entities/location.entity"
import { AppDataSource } from "../../config/database"
import { NotFoundException } from "../../core/exceptions/base"

export class AssetLocationService {
    constructor(private readonly repository: IAssetLocationRepository) {}

    async getAll(
        page: number,
        limit: number,
        q: string,
        sortBy?: string,
        order?: 'ASC' | 'DESC',
        assetId?: number
    ): Promise<{ data: AssetLocation[]; total: number }> {
        return await this.repository.findAll(page, limit, q, sortBy, order, assetId)
    }

    async getById(id: number): Promise<AssetLocation> {
        const log = await this.repository.findById(id)
        if (!log) {
            throw new NotFoundException("Asset location record not found")
        }
        return log
    }

    async create(data: Partial<AssetLocation>): Promise<AssetLocation> {
        // Validate asset exists
        const assetRepo = AppDataSource.getRepository(Asset)
        const assetExists = await assetRepo.findOneBy({ id: data.assetId })
        if (!assetExists) {
            throw new NotFoundException("Asset not found")
        }

        // Validate location exists
        const locationRepo = AppDataSource.getRepository(Location)
        const locationExists = await locationRepo.findOneBy({ id: data.locationId })
        if (!locationExists) {
            throw new NotFoundException("Location not found")
        }

        const queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            const log = await this.repository.save({
                assetId: data.assetId,
                locationId: data.locationId,
                date: data.date,
                note: data.note,
                createdByUserId: data.createdByUserId,
            }, queryRunner.manager)

            await queryRunner.commitTransaction()

            // Reload with relations
            const reloaded = await this.repository.findById(log.id)
            if (!reloaded) throw new NotFoundException("Created record could not be loaded")
            return reloaded
        } catch (err) {
            await queryRunner.rollbackTransaction()
            throw err
        } finally {
            await queryRunner.release()
        }
    }
}
