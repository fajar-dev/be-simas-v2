import { TypeOrmCategoryRepository } from "./repositories/typeorm-category.repository"
import { CategoryService } from "./category.service"
import { CategoryController } from "./category.controller"

const categoryRepository = new TypeOrmCategoryRepository()
const categoryService = new CategoryService(categoryRepository)

export const categoryController = new CategoryController(categoryService)
