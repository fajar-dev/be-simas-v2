import { BookService } from "./book.service"
import { BookController } from "./book.controller"
import { TypeOrmBookRepository } from "./repositories/typeorm-book.repository"
import { assetHolderService } from "../asset-holder/asset-holder.module"
import { assetService } from "../asset/asset.module"
import { attachmentService } from "../attachment/attachment.module"

const bookRepository = new TypeOrmBookRepository()
export const bookService = new BookService(assetHolderService, assetService, bookRepository, attachmentService)
export const bookController = new BookController(bookService)