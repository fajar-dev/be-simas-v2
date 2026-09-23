import { Transfer } from "./entities/transfer.entity"
import { ITransferRepository, TransferFilter } from "./interfaces/transfer.repository.interface"
import { NotFoundException, ConflictException } from "../../core/exceptions/base"
import { AssetService } from "../asset/asset.service"
import { CreateTransferValidator } from "./validators/transfer.validator"

export class TransferService {
    constructor(
        private readonly repository: ITransferRepository,
        private readonly assetService: AssetService
    ) {}

    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: "ASC" | "DESC", filters?: TransferFilter): Promise<{ data: Transfer[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, filters)
        await Promise.all(data.map((t) => this.populateMergedAssets(t)))
        return { data, total }
    }

    async getById(id: number): Promise<Transfer> {
        const transfer = await this.findOrFail(id)
        await this.populateMergedAssets(transfer)
        return transfer
    }

    /** Always exactly one row — `quantity`/`code` are expanded into that many Assets at merge time, not here. */
    async intake(data: CreateTransferValidator): Promise<Transfer> {
        return await this.repository.save({
            name: data.name,
            price: data.price ?? null,
            code: data.code.length > 0 ? data.code : null,
            quantity: data.quantity,
            purchaseDate: data.purchaseDate || null,
            createdBy: data.createdBy || null,
            status: "pending",
        })
    }

    /**
     * Links a transfer row to the Asset(s) a user already created (via the normal Asset
     * create form, pre-filled from this row — one code entry per unit) and marks it merged.
     */
    async merge(id: number, assetIds: number[]): Promise<Transfer> {
        const transfer = await this.findOrFail(id)
        if (transfer.status === "merged") {
            throw new ConflictException("Transfer item has already been merged")
        }
        for (const assetId of assetIds) {
            await this.assetService.getById(assetId) // throws NotFoundException if invalid
        }

        this.repository.merge(transfer, { status: "merged", mergedAssetIds: assetIds })
        await this.repository.save(transfer)
        return await this.getById(id)
    }

    private async populateMergedAssets(transfer: Transfer): Promise<void> {
        if (!transfer.mergedAssetIds?.length) {
            transfer.mergedAssets = []
            return
        }
        const assets = await Promise.all(
            transfer.mergedAssetIds.map((assetId) => this.assetService.getById(assetId).catch(() => null))
        )
        transfer.mergedAssets = assets
            .filter((asset): asset is NonNullable<typeof asset> => asset !== null)
            .map((asset) => ({ id: asset.id, code: asset.code, name: asset.name }))
    }

    private async findOrFail(id: number): Promise<Transfer> {
        const transfer = await this.repository.findById(id)
        if (!transfer) {
            throw new NotFoundException("Transfer item not found")
        }
        return transfer
    }
}
