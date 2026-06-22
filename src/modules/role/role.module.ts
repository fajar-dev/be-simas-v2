import { RoleService } from "./role.service"
import { RoleController } from "./role.controller"

const roleService = new RoleService()
const roleController = new RoleController(roleService)

export { roleService, roleController }
