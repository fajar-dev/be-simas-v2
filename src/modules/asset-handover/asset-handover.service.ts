import { AssetHandover } from "./entities/asset-handover.entity"
import { IAssetHandoverRepository, AssetHandoverFilter } from "./interfaces/asset-handover.repository.interface"
import { NotFoundException, BadRequestException } from "../../core/exceptions/base"
import { withTransaction } from "../../core/helpers/transaction"
import { CreateAssetHandoverValidator } from "./validators/asset-handover.validator"
import { AssetService } from "../asset/asset.service"
import { EmployeeService } from "../employee/employee.service"
import { AssetHolderService } from "../asset-holder/asset-holder.service"
import { AssetLogService } from "../asset-log/asset-log.service"
import { AttachmentService } from "../attachment/attachment.service"
import { Attachment } from "../attachment/entities/attachment.entity"
import { AssetHolder } from "../asset-holder/entities/asset-holder.entity"
import { generateHandoverPdf } from "../../core/helpers/handover-pdf"
import { esignHelper, EsignSigner } from "../../core/helpers/esign"

const ENTITY_HANDOVER = "AssetHandover"
const ENTITY_HOLDER = "AssetHolder"

export type HandoverWithAttachments = { handover: AssetHandover; attachments: Attachment[] }

export class AssetHandoverService {
    constructor(
        private readonly repository: IAssetHandoverRepository,
        private readonly assetService: AssetService,
        private readonly employeeService: EmployeeService,
        private readonly assetHolderService: AssetHolderService,
        private readonly assetLogService: AssetLogService,
        private readonly attachmentService: AttachmentService
    ) {}


    async getAll(page: number, limit: number, q: string, sortBy?: string, order?: 'ASC' | 'DESC', filters?: AssetHandoverFilter): Promise<{ data: HandoverWithAttachments[]; total: number }> {
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
    private async findOrFail(id: number): Promise<AssetHandover> {
        const handover = await this.repository.findById(id)
        if (!handover) {
            throw new NotFoundException("Asset handover not found")
        }
        return handover
    }

    async getPendingItemAssetIds(): Promise<number[]> {
        return await this.repository.findPendingItemAssetIds()
    }

    /** Validate every item's asset, and that assets are available (no active holder, not in another pending handover, no duplicates). */
    private async validateItems(items: {assetId: number, note?: string | null}[], excludeHandoverId?: number): Promise<void> {
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

            // Asset must not already have an active holder
            const activeHolder = await this.assetHolderService.findActiveHolder(item.assetId)
            if (activeHolder) {
                throw new BadRequestException(`Asset "${asset.name}" already has an active holder`)
            }

            // Asset must not be part of another pending handover
            if (pendingAssetIds.has(item.assetId)) {
                throw new BadRequestException(`Asset "${asset.name}" is already in another pending handover`)
            }
        }
    }

    async create(data: CreateAssetHandoverValidator, userId?: number): Promise<HandoverWithAttachments> {
        // Validate employee exists & active
        const receivedByEmployee = await this.employeeService.getById(data.receivedById)
        if (!receivedByEmployee.isActive) {
            throw new BadRequestException(`Cannot hand over asset to inactive employee "${receivedByEmployee.name}"`)
        }

        // Validate handing over employee exists & active
        const handedOverBy = await this.employeeService.getById(data.handedOverById)
        if (!handedOverBy.isActive) {
            throw new BadRequestException(`Handing over employee "${handedOverBy.name}" is inactive`)
        }

        await this.validateItems(data.items)

        const handover = await withTransaction(async (manager) => {
            const created = await this.repository.save({
                receivedById: data.receivedById,
                handedOverById: data.handedOverById,
                transactionType: data.transactionType,
                note: data.note ?? null,
                status: "pending",
                createdByUserId: userId ?? null,
            }, manager)

            for (const item of data.items) {
                await this.repository.saveItem({
                    handoverId: created.id,
                    assetId: item.assetId,
                    note: item.note ?? null,
                }, manager)
            }

            return created
        })

        const full = await this.findOrFail(handover.id)

        // Generate the signed-handover form, store it as an attachment, and
        // send it to the e-sign provider for the two parties to sign.
        await this.dispatchForSigning(full)

        return await this.getById(handover.id)
    }

    /** Build the handover PDF form, attach it to the handover, and submit it to e-sign. */
    private async dispatchForSigning(handover: AssetHandover): Promise<void> {
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
                    handoverId: handover.id,
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
                    newValue: { handoverId: handover.id, assetHolderId: holder.id },
                }, manager)
            }

            this.repository.merge(handover, {
                status: "approve",
            })
            await this.repository.save(handover, manager)
        })

        // On approval from e-sign, point the handover's document at the signed
        // file URL and attach that signed document to every created holder.
        if (fileUrl) {
            await this.attachSignedDocument(handover.id, createdHolders, fileUrl)
        }

        return await this.getById(id)
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
