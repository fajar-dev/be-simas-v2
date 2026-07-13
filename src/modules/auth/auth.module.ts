import { userService } from "../user/user.module"
import { mailHelper } from "../../core/helpers/mail"
import { AuthService } from "./auth.service"
import { NusaworkAuthService } from "./nusawork-auth.service"
import { AuthController } from "./auth.controller"
import { PasswordResetTokenRepository } from "./repositories/password-reset-token.repository"

const passwordResetTokenRepository = new PasswordResetTokenRepository()
const authService = new AuthService(userService, mailHelper, passwordResetTokenRepository)
const nusaworkAuthService = new NusaworkAuthService(userService)

export const authController = new AuthController(authService, nusaworkAuthService)

