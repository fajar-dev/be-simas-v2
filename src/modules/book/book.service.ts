import { AssetHolderService } from "../asset-holder/asset-holder.service"
import type { AssetService } from "../asset/asset.service"
import type { EmployeeService } from "../employee/employee.service"
import { AttachmentService } from "../attachment/attachment.service"
import { AssetHolderSerializer } from "../asset-holder/serializers/asset-holder.serialize"
import { BadRequestException, NotFoundException } from "../../core/exceptions/base"

const BOOK_CATEGORY = 'Buku'

export class BookService {
    constructor(
        private readonly assetHolderService: AssetHolderService,
        private readonly assetService: AssetService,
    ) {}

    async borrow(data: {
        assetId: number
        employeeId: number
        createdByUserId: number
        assignNote?: string | null
        attachmentIds?: number[]
    }) {
        // Validate asset exists and is a book
        const asset = await this.assetService.getById(data.assetId)
        const categoryName = asset.subCategory?.category?.name || ''
        if (categoryName.toLowerCase() !== BOOK_CATEGORY.toLowerCase()) {
            throw new BadRequestException('This asset is not a book category')
        }
        if (!asset.hasHolder) {
            throw new BadRequestException('Holder feature is not enabled for this asset')
        }

        // Validate: last status must be active
        const lastStatus = asset.lastStatus?.status
        if (lastStatus !== 'active') {
            throw new BadRequestException('This book is not in active status')
        }

        const log = await this.assetHolderService.create({
            assetId: data.assetId,
            employeeId: data.employeeId,
            assignedDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            assignNote: data.assignNote || null,
            createdByUserId: data.createdByUserId,
            attachmentIds: data.attachmentIds,
        })

        const result = await this.assetHolderService.getById(log.id)
        return await AssetHolderSerializer.single(result.log, result.attachments)
    }

    async returnBook(data: {
        assetHolderId: number
        returnedByUserId: number
        returnNote?: string | null
        attachmentIds?: number[]
    }) {
        const log = await this.assetHolderService.returnAsset(data.assetHolderId, {
            returnedDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            returnNote: data.returnNote || undefined,
            returnedByUserId: data.returnedByUserId,
            attachmentIds: data.attachmentIds,
        })

        const result = await this.assetHolderService.getById(log.id)
        return await AssetHolderSerializer.single(result.log, result.attachments)
    }

    async getMyBorrowedBooks(employeeId: number) {
        const { data } = await this.assetHolderService.getAll(1, 100, '', undefined, undefined, undefined, employeeId)
        // Filter only active (not returned)
        const active = data.filter(d => !d.log.returnedDate)
        return await AssetHolderSerializer.collection(active)
    }
}