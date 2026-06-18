import { TypeOrmSubCategoryRepository } from "./repositories/typeorm-sub-category.repository"
import { SubCategoryService } from "./sub-category.service"
import { SubCategoryController } from "./sub-category.controller"

const subCategoryRepository = new TypeOrmSubCategoryRepository()
const subCategoryService = new SubCategoryService(subCategoryRepository)

export const subCategoryController = new SubCategoryController(subCategoryService)
