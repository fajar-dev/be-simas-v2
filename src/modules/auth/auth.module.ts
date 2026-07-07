import { userService } from "../user/user.module"
import { mailHelper } from "../../core/helpers/mail"
import { AuthService } from "./auth.service"
import { QrCodeAuthService } from "./qrcode-auth.service"
import { AuthController } from "./auth.controller"
import { PasswordResetTokenRepository } from "./repositories/password-reset-token.repository"

const passwordResetTokenRepository = new PasswordResetTokenRepository()
const authService = new AuthService(userService, mailHelper, passwordResetTokenRepository)
const qrCodeAuthService = new QrCodeAuthService(userService)

export const authController = new AuthController(authService, qrCodeAuthService)
