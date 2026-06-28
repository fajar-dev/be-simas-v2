import { userService } from "../user/user.module"
import { AuthService } from "./auth.service"
import { QrCodeAuthService } from "./qrcode-auth.service"
import { AuthController } from "./auth.controller"

const authService = new AuthService(userService)
const qrCodeAuthService = new QrCodeAuthService(userService)

export const authController = new AuthController(authService, qrCodeAuthService)
