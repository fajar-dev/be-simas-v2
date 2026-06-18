import { TypeOrmBranchRepository } from "./repositories/typeorm-branch.repository"
import { BranchService } from "./branch.service"
import { BranchController } from "./branch.controller"

const branchRepository = new TypeOrmBranchRepository()
const branchService = new BranchService(branchRepository)

export const branchController = new BranchController(branchService)
