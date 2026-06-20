import { CategoryRepository } from "./repositories/category.repository"
import { CategoryService } from "./category.service"
import { CategoryController } from "./category.controller"

const categoryRepository = new CategoryRepository()
const categoryService = new CategoryService(categoryRepository)

export const categoryController = new CategoryController(categoryService)
