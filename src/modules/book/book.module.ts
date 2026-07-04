import { BookService } from "./book.service"
import { BookController } from "./book.controller"
import { assetHolderService } from "../asset-holder/asset-holder.module"
import { assetService } from "../asset/asset.module"
import { employeeService } from "../employee/employee.module"
import { attachmentService } from "../attachment/attachment.module"

export const bookService = new BookService(assetHolderService, assetService, employeeService, attachmentService)
export const bookController = new BookController(bookService)
