import { BookService } from "./book.service"
import { BookController } from "./book.controller"
import { assetHolderService } from "../asset-holder/asset-holder.module"
import { assetService } from "../asset/asset.module"

export const bookService = new BookService(assetHolderService, assetService)
export const bookController = new BookController(bookService)