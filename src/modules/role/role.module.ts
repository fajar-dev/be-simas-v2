import { RoleService } from "./role.service"
import { RoleController } from "./role.controller"
import { RoleRepository } from "./repositories/role.repository"

const roleRepository = new RoleRepository()
const roleService = new RoleService(roleRepository)
const roleController = new RoleController(roleService)

export { roleService, roleController }
