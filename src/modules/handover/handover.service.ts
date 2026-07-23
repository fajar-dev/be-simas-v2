import { Handover } from "./entities/handover.entity"
import { IHandoverRepository, HandoverFilter } from "./interfaces/handover.repository.interface"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { CreateHandoverValidator } from "./validators/handover.validator"
import { AssetService } from "../asset/asset.service"
import { EmployeeService } from "../employee/employee.service"
import { AssetHolderService } from "../asset-holder/asset-holder.service"
import { AssetLogService } from "../asset-log/asset-log.service"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { AssetHolder } from "../asset-holder/entities/asset-holder.entity"
import { generateHandoverPdf } from "../../core/helpers/handover-pdf"
import { esignHelper, EsignSigner } from "../../core/helpers/esign"
import { HandoverFieldService } from "../handover-field/handover-field.service"
import { InventoryStockOutService } from "../inventory-stock-out/inventory-stock-out.service"
import type { HandoverTransactionType } from "../../core/enums"

const ENTITY_HANDOVER = "Handover"
const ENTITY_HOLDER = "AssetHolder"

export type HandoverWithAttachments = { handover: Handover; attachments: Attachment[] }

export class HandoverService {
    constructor(
        private readonly repository: IHandoverRepository,
        private readonly assetService: AssetService,
        private readonly employeeService: EmployeeService,
        private readonly assetHolderService: AssetHolderService,
        private readonly assetLogService: AssetLogService,
        private readonly attachmentService: AttachmentService,
        private readonly handoverFieldService: HandoverFieldService,
        private readonly inventoryStockOutService: InventoryStockOutService
    ) {}


    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: HandoverFilter): Promise<{ data: HandoverWithAttachments[]; total: number }> {
        const { data, total } = await this.repository.findAll(page, limit, q, sortBy, order, filters)
        const withAttachments = await Promise.all(
            data.map(async (handover) => ({
                handover,
                attachments: await this.attachmentService.getForEntity(ENTITY_HANDOVER, handover.id),
            }))
        )
        return { data: withAttachments, total }
    }

    async getById(id: number): Promise<HandoverWithAttachments> {
        const handover = await this.findOrFail(id)
        const attachments = await this.attachmentService.getForEntity(ENTITY_HANDOVER, id)
        return { handover, attachments }
    }

    /** Fetch a handover entity or throw; used internally where attachments aren't needed. */
    private async findOrFail(id: number): Promise<Handover> {
        const handover = await this.repository.findById(id)
        if (!handover) {
            throw new NotFoundException("Asset handover not found")
        }
        return handover
    }

    async getPendingItemAssetIds(): Promise<number[]> {
        return await this.repository.findPendingItemAssetIds()
    }

    /**
     * Validate a handover's items depending on its transaction type.
     * Common rules: at least one item, no duplicates, and no asset already in another pending handover.
     * - `assign`: each asset must be free (no active holder).
     * - `return`: each asset must currently be held by the returning employee (`handedOverById`).
     */
    private async validateItems(
        transactionType: HandoverTransactionType,
        items: { assetId: number; note?: string | null }[],
        handedOverById: number,
        excludeHandoverId?: number
    ): Promise<void> {
        if (!items || items.length === 0) {
            throw new BadRequestException("At least one item is required")
        }

        // No duplicate asset within the same handover
        const seen = new Set<number>()
        for (const item of items) {
            if (seen.has(item.assetId)) {
                throw new BadRequestException(`Duplicate asset in handover (asset ID ${item.assetId})`)
            }
            seen.add(item.assetId)
        }

        const pendingAssetIds = new Set(await this.repository.findPendingItemAssetIds(excludeHandoverId))

        for (const item of items) {
            // Validate asset exists (throws NotFoundException if not found)
            const asset = await this.assetService.getById(item.assetId)

            // Asset must not be part of another pending handover (assign or return)
            if (pendingAssetIds.has(item.assetId)) {
                throw new BadRequestException(`Asset "${asset.name}" is already in another pending handover`)
            }

            const activeHolder = await this.assetHolderService.findActiveHolder(item.assetId)

            if (transactionType === "return") {
                // Return: the asset must currently be held by the returning employee.
                if (!activeHolder) {
                    throw new BadRequestException(`Asset "${asset.name}" has no active holder to return`)
                }
                if (activeHolder.employeeId !== handedOverById) {
                    throw new BadRequestException(`Asset "${asset.name}" is not currently held by the returning employee`)
                }
            } else {
                // Assign: the asset must be free.
                if (activeHolder) {
                    throw new BadRequestException(`Asset "${asset.name}" already has an active holder`)
                }
            }
        }
    }

    private async resolveParentHandoverId(assetIds: number[]): Promise<number | null> {
        const originIds: number[] = []
        for (const assetId of assetIds) {
            const holder = await this.assetHolderService.findActiveHolder(assetId)
            if (!holder?.assignHandoverId) return null
            if (!originIds.includes(holder.assignHandoverId)) {
                originIds.push(holder.assignHandoverId)
            }
        }
        return originIds.length === 1 ? originIds[0]! : null
    }

    async create(data: CreateHandoverValidator, userId?: number): Promise<HandoverWithAttachments> {
        const isReturn = data.transactionType === "return"

        // Receiving employee must exist & be active.
        const receivedByEmployee = await this.employeeService.getById(data.receivedById)
        if (!receivedByEmployee.isActive) {
            throw new BadRequestException(`Cannot hand over to inactive employee "${receivedByEmployee.name}"`)
        }

        // Handing-over employee must exist. For a return they may be inactive
        // (e.g. offboarding), so the active check only applies to assigns.
        const handedOverBy = await this.employeeService.getById(data.handedOverById)
        if (!isReturn && !handedOverBy.isActive) {
            throw new BadRequestException(`Handing over employee "${handedOverBy.name}" is inactive`)
        }

        // Snapshot the configured custom fields + values (self-contained; unaffected by later edits).
        const customFields = await this.handoverFieldService.resolveSnapshot(data.transactionType, data.customFields ?? {})

        const handover = data.itemKind === "stock"
            ? await this.createStockHandover(data, userId, isReturn, customFields)
            : await this.createAssetHandover(data, userId, isReturn, customFields)

        const full = await this.findOrFail(handover.id)

        // Generate the signed-handover form, store it as an attachment, and
        // send it to the e-sign provider for the two parties to sign.
        await this.dispatchForSigning(full)

        return await this.getById(handover.id)
    }

    /** Persist an asset-kind handover (existing behaviour). */
    private async createAssetHandover(
        data: CreateHandoverValidator,
        userId: number | undefined,
        isReturn: boolean,
        customFields: { key: string; label: string; type: string; value: string | null }[]
    ): Promise<Handover> {
        const items = data.items ?? []
        await this.validateItems(data.transactionType, items, data.handedOverById)

        // A return handover links back (best-effort) to the origin assign handover.
        const parentHandoverId = isReturn
            ? await this.resolveParentHandoverId(items.map((i) => i.assetId))
            : null

        return await withTransaction(async (manager) => {
            const created = await this.repository.save({
                receivedById: data.receivedById,
                handedOverById: data.handedOverById,
                transactionType: data.transactionType,
                itemKind: "asset",
                note: data.note ?? null,
                customFields: customFields.length ? customFields : null,
                status: "pending",
                parentHandoverId,
                createdByUserId: userId ?? null,
            }, manager)

            for (const item of items) {
                await this.repository.saveItem({
                    handoverId: created.id,
                    assetId: item.assetId,
                    note: item.note ?? null,
                }, manager)
            }

            return created
        })
    }

    /** Persist a stock-kind handover. Stock availability is validated up front and again (locked) on approval. */
    private async createStockHandover(
        data: CreateHandoverValidator,
        userId: number | undefined,
        isReturn: boolean,
        customFields: { key: string; label: string; type: string; value: string | null }[]
    ): Promise<Handover> {
        const stockItems = data.stockItems ?? []

        if (isReturn) {
            // The handing-over employee returns stock they currently hold.
            await this.inventoryStockOutService.assertCanReturn(
                data.handedOverById,
                stockItems.map((si) => ({ variantId: si.variantId, branchId: si.branchId, quantity: si.quantity }))
            )
        } else {
            await this.inventoryStockOutService.assertCanAssign(
                stockItems.map((si) => ({ variantId: si.variantId, branchId: si.branchId, condition: si.condition, quantity: si.quantity }))
            )
        }

        return await withTransaction(async (manager) => {
            const created = await this.repository.save({
                receivedById: data.receivedById,
                handedOverById: data.handedOverById,
                transactionType: data.transactionType,
                itemKind: "stock",
                note: data.note ?? null,
                customFields: customFields.length ? customFields : null,
                status: "pending",
                parentHandoverId: null,
                createdByUserId: userId ?? null,
            }, manager)

            for (const si of stockItems) {
                await this.repository.saveStockItem({
                    handoverId: created.id,
                    variantId: si.variantId,
                    branchId: si.branchId,
                    condition: si.condition,
                    quantity: si.quantity,
                    note: si.note ?? null,
                }, manager)
            }

            return created
        })
    }

    /** Build the handover PDF form, attach it to the handover, and submit it to e-sign. */
    private async dispatchForSigning(handover: Handover): Promise<void> {
        const pdfBytes = await generateHandoverPdf(handover)
        const fileName = `handover-${handover.id}.pdf`
        const file = new File([pdfBytes as any], fileName, { type: "application/pdf" })

        // Persist the generated form as an attachment on the handover.
        const attachment = await this.attachmentService.upload(file)
        await this.attachmentService.associate([attachment.id], ENTITY_HANDOVER, handover.id)

        // Signers: the person handing over and the person receiving.
        const signers: EsignSigner[] = []
        if (handover.handedOverBy) {
            signers.push({
                nama: handover.handedOverBy.name,
                email: handover.handedOverBy.email,
                phone: handover.handedOverBy.phone,
            })
        }
        if (handover.receivedBy) {
            signers.push({
                nama: handover.receivedBy.name,
                email: handover.receivedBy.email,
                phone: handover.receivedBy.phone,
            })
        }

        await esignHelper.documentSign({
            file,
            external_reference_id: handover.id,
            signers,
            title: `Serah Terima Aset #${handover.id}`,
        })
    }

    async approve(id: number, fileUrl?: string): Promise<HandoverWithAttachments> {
        const handover = await this.findOrFail(id)
        if (handover.status !== "pending") {
            throw new BadRequestException(`Only pending handovers can be approved (current status: "${handover.status}")`)
        }

        let affectedHolders: AssetHolder[] = []
        if (handover.itemKind === "stock") {
            if (handover.transactionType === "return") {
                await this.applyStockReturn(handover)
            } else {
                await this.applyStockAssign(handover)
            }
        } else {
            affectedHolders = handover.transactionType === "return"
                ? await this.applyReturn(handover)
                : await this.applyAssign(handover)
        }

        // On approval from e-sign, point the handover's document at the signed
        // file URL and attach that signed document to every affected holder.
        if (fileUrl) {
            await this.attachSignedDocument(handover.id, affectedHolders, fileUrl)
        }

        return await this.getById(id)
    }

    /** Approve a stock `assign` handover: move branch stock into the receiver's holdings. */
    private async applyStockAssign(handover: Handover): Promise<void> {
        const items = (handover.stockItems || []).map((si) => ({
            variantId: si.variantId,
            branchId: si.branchId,
            condition: si.condition,
            quantity: si.quantity,
        }))
        await this.inventoryStockOutService.assign(
            { isEmployee: true, employeeId: handover.receivedById, note: handover.note ?? null, items },
            handover.createdByUserId ?? undefined,
            { handoverId: handover.id }
        )
        this.repository.merge(handover, { status: "approve" })
        await this.repository.save(handover)
    }

    /** Approve a stock `return` handover: return the holder's stock back into `used` at the branch. */
    private async applyStockReturn(handover: Handover): Promise<void> {
        const items = (handover.stockItems || []).map((si) => ({
            variantId: si.variantId,
            branchId: si.branchId,
            quantity: si.quantity,
        }))
        await this.inventoryStockOutService.returnStock(
            { employeeId: handover.handedOverById!, note: handover.note ?? null, items },
            handover.createdByUserId ?? undefined,
            { handoverId: handover.id }
        )
        this.repository.merge(handover, { status: "approve" })
        await this.repository.save(handover)
    }

    /** Approve an `assign` handover: create a new active holder per item. */
    private async applyAssign(handover: Handover): Promise<AssetHolder[]> {
        const items = handover.items || []
        const createdHolders: AssetHolder[] = []

        await withTransaction(async (manager) => {
            for (const item of items) {
                // Guard against a race: asset may have been assigned since creation
                const activeHolder = await this.assetHolderService.findActiveHolder(item.assetId)
                if (activeHolder) {
                    throw new BadRequestException(`Asset "${item.asset?.name || item.assetId}" already has an active holder`)
                }

                const holder = await this.assetHolderService.save({
                    assetId: item.assetId,
                    employeeId: handover.receivedById,
                    assignHandoverId: handover.id,
                    assignedDate: new Date().toISOString(),
                    assignNote: item.note ?? null,
                    createdByUserId: handover.createdByUserId ?? null,
                }, manager)
                createdHolders.push(holder)

                await this.assetLogService.log({
                    assetId: item.assetId,
                    module: "holder",
                    action: "assign",
                    description: `Asset assigned via handover #${handover.id} to employee "${handover.receivedBy?.name || handover.receivedById}".`,
                    createdByUserId: handover.createdByUserId ?? null,
                    newValue: { assignHandoverId: handover.id, assetHolderId: holder.id },
                }, manager)
            }

            this.repository.merge(handover, { status: "approve" })
            await this.repository.save(handover, manager)
        })

        return createdHolders
    }

    /** Approve a `return` handover: mark each item's active holder as returned. */
    private async applyReturn(handover: Handover): Promise<AssetHolder[]> {
        const items = handover.items || []
        const returnedHolders: AssetHolder[] = []

        await withTransaction(async (manager) => {
            for (const item of items) {
                const activeHolder = await this.assetHolderService.findActiveHolder(item.assetId)
                if (!activeHolder) {
                    throw new BadRequestException(`Asset "${item.asset?.name || item.assetId}" has no active holder to return`)
                }
                if (activeHolder.employeeId !== handover.handedOverById) {
                    throw new BadRequestException(`Asset "${item.asset?.name || item.assetId}" is not held by the returning employee`)
                }

                activeHolder.returnedDate = new Date().toISOString()
                activeHolder.returnNote = item.note ?? handover.note ?? null
                activeHolder.returnedByUserId = handover.createdByUserId ?? null
                activeHolder.returnHandoverId = handover.id
                const returned = await this.assetHolderService.save(activeHolder, manager)
                returnedHolders.push(returned)

                await this.assetLogService.log({
                    assetId: item.assetId,
                    module: "holder",
                    action: "return",
                    description: `Asset returned via handover #${handover.id} by employee "${handover.handedOverBy?.name || handover.handedOverById}".`,
                    createdByUserId: handover.createdByUserId ?? null,
                    newValue: { returnHandoverId: handover.id, assetHolderId: activeHolder.id },
                }, manager)
            }

            this.repository.merge(handover, { status: "approve" })
            await this.repository.save(handover, manager)
        })

        return returnedHolders
    }

    /** Swap the handover attachment to the signed URL and attach it to each holder. */
    private async attachSignedDocument(handoverId: number, holders: AssetHolder[], fileUrl: string): Promise<void> {
        const signedName = `handover-${handoverId}-signed.pdf`

        const handoverAttachments = await this.attachmentService.getForEntity(ENTITY_HANDOVER, handoverId)
        for (const attachment of handoverAttachments) {
            await this.attachmentService.updateFilename(attachment.id, fileUrl)
        }

        for (const holder of holders) {
            await this.attachmentService.createExternal({
                url: fileUrl,
                originalName: signedName,
                mimeType: "application/pdf",
                entityType: ENTITY_HOLDER,
                entityId: holder.id,
            })
        }
    }

    async reject(id: number): Promise<HandoverWithAttachments> {
        const handover = await this.findOrFail(id)
        if (handover.status === "reject") {
            throw new BadRequestException("Handover is already rejected")
        }

        this.repository.merge(handover, { status: "reject" })
        await this.repository.save(handover)

        return await this.getById(id)
    }

    /** User-initiated cancellation. Only pending handovers can be cancelled; once approved it is locked. */
    async cancel(id: number): Promise<HandoverWithAttachments> {
        const handover = await this.findOrFail(id)
        if (handover.status !== "pending") {
            throw new BadRequestException(`Only pending handovers can be cancelled (current status: "${handover.status}")`)
        }

        this.repository.merge(handover, { status: "cancel" })
        await this.repository.save(handover)

        return await this.getById(id)
    }
}
