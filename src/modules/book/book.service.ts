import { AssetHolderService } from "../asset-holder/asset-holder.service"
import type { AssetService } from "../asset/asset.service"
import { AttachmentService } from "../attachment/attachment.service"
import { AssetHolderSerializer } from "../asset-holder/serializers/asset-holder.serialize"
import { BadRequestException, NotFoundException } from "../../core/exceptions/base"
import { IBookRepository } from "./interfaces/book.repository.interface"
import { resolveFileUrl } from "../../core/helpers/serializer-utils"

const BOOK_CATEGORY = 'Buku'

export class BookService {
    constructor(
        private readonly assetHolderService: AssetHolderService,
        private readonly assetService: AssetService,
        private readonly bookRepository: IBookRepository,
        private readonly attachmentService: AttachmentService,
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

    async getLoans(search?: string, startDate?: string, endDate?: string, hasReturn?: boolean | string) {
        let hasReturnFilter: boolean | undefined
        if (hasReturn !== undefined && hasReturn !== '') {
            hasReturnFilter = String(hasReturn) === 'true'
        }

        const loans = await this.bookRepository.findLoans({
            search,
            startDate,
            endDate,
            hasReturn: hasReturnFilter,
        })

        const employeeLoans: Record<string, any> = {}

        for (const loan of loans) {
            const empId = loan.employee.employeeId
            if (!employeeLoans[empId]) {
                employeeLoans[empId] = {
                    employee: loan.employee.name,
                    bookLoans: {},
                }
            }
        }

        await Promise.all(loans.map(async (loan) => {
            const empId = loan.employee.employeeId
            const attachments = await this.attachmentService.getForEntity("AssetHolder", loan.id)

            const [imageUrl, loanPhoto, returnPhoto] = await Promise.all([
                resolveFileUrl(loan.asset.image),
                attachments[0] ? resolveFileUrl(attachments[0].filename) : Promise.resolve(null),
                attachments[1] ? resolveFileUrl(attachments[1].filename) : Promise.resolve(null),
            ])

            employeeLoans[empId].bookLoans[loan.id] = {
                code: loan.asset.code,
                name: loan.asset.name,
                imageUrl,
                subCategory: loan.asset.subCategory?.name || null,
                loanHistory: {
                    loaning: {
                        loanPeriod: loan.assignedDate,
                        loanPhoto,
                    },
                    return: {
                        returnTime: loan.returnedDate,
                        returnPhoto,
                        linkReview: loan.returnNote || null,
                    },
                },
            }
        }))

        return [employeeLoans]
    }

    async getMyBorrowedBooks(employeeId: number) {
        const activeLoans = await this.bookRepository.findActiveLoans(employeeId)
        const mapped = await Promise.all(activeLoans.map(async (log) => {
            const attachments = await this.attachmentService.getForEntity("AssetHolder", log.id)
            return { log, attachments }
        }))
        return await AssetHolderSerializer.collection(mapped)
    }
}