import { Context } from "hono"
import { BookService } from "./book.service"
import { ApiResponse } from "../../core/helpers/response"
import { BadRequestException } from "../../core/exceptions/base"

export class BookController {
    constructor(private readonly service: BookService) {}

    async borrow(c: Context) {
        const user = c.get("user")
        if (!user?.employeeId) {
            throw new BadRequestException("Your account is not linked to an employee")
        }

        const body = c.req.valid("json" as never) as any
        const result = await this.service.borrow({
            assetId: body.assetId,
            employeeId: user.employeeId,
            createdByUserId: user.id,
            assignNote: body.assignNote,
            attachmentIds: body.attachmentIds,
        })

        return ApiResponse.success(c, result, "Book borrowed successfully", 201)
    }

    async returnBook(c: Context) {
        const user = c.get("user")
        const body = c.req.valid("json" as never) as any

        const result = await this.service.returnBook({
            assetHolderId: body.assetHolderId,
            returnedByUserId: user?.id,
            returnNote: body.returnNote,
            attachmentIds: body.attachmentIds,
        })

        return ApiResponse.success(c, result, "Book returned successfully")
    }

    async loans(c: Context) {
        const search = c.req.query("search") || undefined
        const startDate = c.req.query("startDate") || undefined
        const endDate = c.req.query("endDate") || undefined
        const hasReturn = c.req.query("hasReturn")

        const data = await this.service.getLoans(search, startDate, endDate, hasReturn)
        return ApiResponse.success(c, data, "Loans retrieved successfully")
    }

    async myBooks(c: Context) {
        const user = c.get("user")
        if (!user?.employeeId) {
            throw new BadRequestException("Your account is not linked to an employee")
        }

        const data = await this.service.getMyBorrowedBooks(user.employeeId)
        return ApiResponse.success(c, data, "Borrowed books retrieved successfully")
    }
}