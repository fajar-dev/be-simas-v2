import { SubCategoryRepository } from "./repositories/sub-category.repository"
import { SubCategoryService } from "./sub-category.service"
import { SubCategoryController } from "./sub-category.controller"

const subCategoryRepository = new SubCategoryRepository()
const subCategoryService = new SubCategoryService(subCategoryRepository)

export const subCategoryController = new SubCategoryController(subCategoryService)
